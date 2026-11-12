import { db } from "@dokploy/server/db";
import {
	forkSsoSettings,
	type SsoSettingsInput,
	ssoProvider,
	user,
} from "@dokploy/server/db/schema";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { auth } from "../../lib/auth";
import { getOrganizationOwnerId } from "./org";
import { defaultSsoRoleSettings } from "./sso-roles";

export const normalizeDomains = (domains: string[]) =>
	Array.from(
		new Set(
			domains.map((domain) => domain.trim().toLowerCase()).filter(Boolean),
		),
	);

const domainsOverlap = (a: string, b: string) =>
	a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);

/** Sign-in matches subdomains, so a domain may not equal or nest inside another provider's. */
export const findDomainConflict = (
	domains: string[],
	others: { providerId: string; domain: string }[],
) => {
	for (const other of others) {
		const otherDomains = other.domain.split(",").map((d) => d.trim());
		for (const domain of domains) {
			const clash = otherDomains.find((existing) =>
				domainsOverlap(domain, existing),
			);
			if (clash) return { domain, providerId: other.providerId, clash };
		}
	}
	return null;
};

const assertDomainsAvailable = async (
	domains: string[],
	exceptProviderId?: string,
) => {
	const others = (
		await db
			.select({
				providerId: ssoProvider.providerId,
				domain: ssoProvider.domain,
			})
			.from(ssoProvider)
	).filter((row) => row.providerId !== exceptProviderId);
	const conflict = findDomainConflict(domains, others);
	if (conflict) {
		throw new TRPCError({
			code: "CONFLICT",
			message: `The domain ${conflict.domain} overlaps ${conflict.clash}, which another SSO provider already uses`,
		});
	}
};

const addTrustedOrigin = async (organizationId: string, issuer: string) => {
	const ownerId = await getOrganizationOwnerId(organizationId);
	if (!ownerId) return;
	const origin = new URL(issuer).origin;
	const owner = await db.query.user.findFirst({
		where: eq(user.id, ownerId),
		columns: { trustedOrigins: true },
	});
	const current = owner?.trustedOrigins ?? [];
	if (current.includes(origin)) return;
	await db
		.update(user)
		.set({ trustedOrigins: [...current, origin] })
		.where(eq(user.id, ownerId));
};

const parseOidcConfig = (raw: string | null) => {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as { clientId?: string; scopes?: string[] };
	} catch {
		return null;
	}
};

const scopes = ["openid", "email", "profile"];

export const listSsoProviders = async (organizationId: string) => {
	const rows = await db.query.ssoProvider.findMany({
		where: eq(ssoProvider.organizationId, organizationId),
	});
	const settings = await db.query.forkSsoSettings.findMany();
	return rows.map((row) => {
		const config = parseOidcConfig(row.oidcConfig);
		const own = settings.find((s) => s.providerId === row.providerId);
		return {
			providerId: row.providerId,
			issuer: row.issuer,
			clientId: config?.clientId ?? "",
			domains: row.domain.split(",").map((d) => d.trim()),
			createdAt: row.createdAt,
			settings: own
				? {
						groupsClaim: own.groupsClaim,
						roleMappings: own.roleMappings,
						defaultRole: own.defaultRole,
						requireMappedGroup: own.requireMappedGroup,
					}
				: defaultSsoRoleSettings,
		};
	});
};

const findOwnedProvider = async (
	organizationId: string,
	providerId: string,
) => {
	const row = await db.query.ssoProvider.findFirst({
		where: eq(ssoProvider.providerId, providerId),
	});
	if (!row || row.organizationId !== organizationId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "SSO provider not found",
		});
	}
	return row;
};

const saveSettings = async (providerId: string, settings: SsoSettingsInput) => {
	await db
		.insert(forkSsoSettings)
		.values({ providerId, ...settings })
		.onConflictDoUpdate({
			target: forkSsoSettings.providerId,
			set: settings,
		});
};

const toTrpcError = (error: unknown): never => {
	if (error instanceof TRPCError) throw error;
	const message =
		error instanceof Error ? error.message : "The SSO provider request failed";
	throw new TRPCError({ code: "BAD_REQUEST", message, cause: error });
};

export const createSsoProvider = async ({
	organizationId,
	headers,
	input,
}: {
	organizationId: string;
	headers: Headers;
	input: {
		providerId: string;
		issuer: string;
		clientId: string;
		clientSecret: string;
		domains: string[];
		settings: SsoSettingsInput;
	};
}) => {
	const domains = normalizeDomains(input.domains);
	await assertDomainsAvailable(domains);
	await addTrustedOrigin(organizationId, input.issuer);
	try {
		// The plugin fetches and validates the issuer's discovery document before saving.
		await auth.registerSSOProvider({
			headers,
			body: {
				providerId: input.providerId,
				issuer: input.issuer,
				domain: domains.join(","),
				organizationId,
				oidcConfig: {
					clientId: input.clientId,
					clientSecret: input.clientSecret,
					scopes,
					pkce: true,
				},
			},
		});
	} catch (error) {
		toTrpcError(error);
	}
	await saveSettings(input.providerId, input.settings);
};

export const updateSsoProvider = async ({
	organizationId,
	headers,
	input,
}: {
	organizationId: string;
	headers: Headers;
	input: {
		providerId: string;
		clientId?: string;
		clientSecret?: string;
		domains?: string[];
		settings?: SsoSettingsInput;
	};
}) => {
	const existing = await findOwnedProvider(organizationId, input.providerId);
	const domains = input.domains ? normalizeDomains(input.domains) : undefined;
	if (domains) await assertDomainsAvailable(domains, input.providerId);

	const config = parseOidcConfig(existing.oidcConfig);
	const credentialsChanged = input.clientId || input.clientSecret;
	if (domains || credentialsChanged) {
		try {
			await auth.updateSSOProvider({
				headers,
				body: {
					providerId: input.providerId,
					...(domains ? { domain: domains.join(",") } : {}),
					...(credentialsChanged
						? {
								oidcConfig: {
									clientId: input.clientId || config?.clientId,
									...(input.clientSecret
										? { clientSecret: input.clientSecret }
										: {}),
								},
							}
						: {}),
				},
			});
		} catch (error) {
			toTrpcError(error);
		}
		if (domains) {
			// Domain ownership is asserted by an owner or admin; DNS verification is not used.
			await db
				.update(ssoProvider)
				.set({ domainVerified: true })
				.where(eq(ssoProvider.providerId, input.providerId));
		}
	}
	if (input.settings) await saveSettings(input.providerId, input.settings);
};

export const deleteSsoProvider = async ({
	organizationId,
	providerId,
}: {
	organizationId: string;
	providerId: string;
}) => {
	await findOwnedProvider(organizationId, providerId);
	await db.delete(ssoProvider).where(eq(ssoProvider.providerId, providerId));
};

export const countSsoProviders = async () =>
	(await db.select({ id: ssoProvider.id }).from(ssoProvider)).length;
