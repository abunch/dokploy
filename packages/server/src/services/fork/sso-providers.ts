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

const loadOtherProviders = async (exceptProviderId?: string) =>
	(
		await db
			.select({
				providerId: ssoProvider.providerId,
				domain: ssoProvider.domain,
				organizationId: ssoProvider.organizationId,
				enabled: forkSsoSettings.enabled,
			})
			.from(ssoProvider)
			.leftJoin(
				forkSsoSettings,
				eq(forkSsoSettings.providerId, ssoProvider.providerId),
			)
	)
		.filter((row) => row.providerId !== exceptProviderId)
		.map((row) => ({ ...row, enabled: row.enabled !== false }));

/**
 * Another organization's domains are always off limits. Within the organization, domains may
 * overlap only between providers that are not both active, so a replacement can be staged.
 * Returns the active same-organization providers this one overlaps.
 */
const checkDomains = async (
	organizationId: string,
	domains: string[],
	exceptProviderId?: string,
) => {
	const others = await loadOtherProviders(exceptProviderId);
	const otherOrg = findDomainConflict(
		domains,
		others.filter((row) => row.organizationId !== organizationId),
	);
	if (otherOrg) {
		throw new TRPCError({
			code: "CONFLICT",
			message: `The domain ${otherOrg.domain} overlaps ${otherOrg.clash}, which another organization's SSO provider uses`,
		});
	}
	return others.filter(
		(row) =>
			row.organizationId === organizationId &&
			row.enabled &&
			findDomainConflict(domains, [row]) !== null,
	);
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
			displayName: own?.displayName ?? "",
			enabled: own?.enabled !== false,
			settings: own
				? {
						displayName: own.displayName ?? undefined,
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

const saveSettings = async (
	providerId: string,
	settings: SsoSettingsInput,
	enabled?: boolean,
) => {
	await db
		.insert(forkSsoSettings)
		.values({
			providerId,
			...settings,
			...(enabled === undefined ? {} : { enabled }),
		})
		.onConflictDoUpdate({
			target: forkSsoSettings.providerId,
			set: { ...settings, ...(enabled === undefined ? {} : { enabled }) },
		});
};

export const isProviderEnabled = async (providerId: string) => {
	const row = await db.query.forkSsoSettings.findFirst({
		where: eq(forkSsoSettings.providerId, providerId),
		columns: { enabled: true },
	});
	return row?.enabled !== false;
};

/**
 * Activating a provider deactivates the organization's active providers whose domains overlap,
 * in one transaction, so switching providers leaves no gap.
 */
export const setSsoProviderActive = async ({
	organizationId,
	providerId,
	active,
	ssoRequired,
}: {
	organizationId: string;
	providerId: string;
	active: boolean;
	ssoRequired: boolean;
}) => {
	const provider = await findOwnedProvider(organizationId, providerId);
	if (!active) {
		const others = (await loadOtherProviders(providerId)).filter(
			(row) => row.enabled,
		);
		if (ssoRequired && others.length === 0) {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message:
					"Turn off Require SSO before deactivating the last active provider",
			});
		}
		await upsertEnabled(providerId, false);
		return { deactivated: [] as string[] };
	}
	const domains = provider.domain.split(",").map((d) => d.trim());
	const overlapping = await checkDomains(organizationId, domains, providerId);
	await db.transaction(async (tx) => {
		for (const other of overlapping) {
			await upsertEnabled(other.providerId, false, tx);
		}
		await upsertEnabled(providerId, true, tx);
	});
	return { deactivated: overlapping.map((row) => row.providerId) };
};

const upsertEnabled = async (
	providerId: string,
	enabled: boolean,
	tx: Pick<typeof db, "insert"> = db,
) => {
	await tx
		.insert(forkSsoSettings)
		.values({ providerId, enabled })
		.onConflictDoUpdate({
			target: forkSsoSettings.providerId,
			set: { enabled },
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
	const overlappingActive = await checkDomains(organizationId, domains);
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
	await db
		.update(ssoProvider)
		.set({ domainVerified: true })
		.where(eq(ssoProvider.providerId, input.providerId));
	// A provider that would clash with an active one starts inactive, ready to be switched to.
	const enabled = overlappingActive.length === 0;
	await saveSettings(input.providerId, input.settings, enabled);
	return { enabled };
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
	if (domains) {
		const overlappingActive = await checkDomains(
			organizationId,
			domains,
			input.providerId,
		);
		if (
			overlappingActive.length > 0 &&
			(await isProviderEnabled(input.providerId))
		) {
			throw new TRPCError({
				code: "CONFLICT",
				message: `Those domains overlap the active provider ${overlappingActive[0]?.providerId}`,
			});
		}
	}

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

export const countActiveSsoProviders = async () =>
	(await loadOtherProviders()).filter((row) => row.enabled).length;
