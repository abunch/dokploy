import { db } from "@dokploy/server/db";
import {
	forkSsoSettings,
	member,
	type SsoMappedRole,
	type SsoRoleMapping,
	ssoProvider,
	user,
} from "@dokploy/server/db/schema";
import { and, eq } from "drizzle-orm";

const rolePriority: Record<SsoMappedRole, number> = { member: 1, admin: 2 };

export interface SsoRoleSettings {
	groupsClaim: string;
	roleMappings: SsoRoleMapping[];
	defaultRole: SsoMappedRole;
	requireMappedGroup: boolean;
}

// More providers than this and the sign-in page asks for an email instead of showing a button each.
export const MAX_SSO_BUTTONS = 3;

export interface SsoLoginOptions {
	buttons: { providerId: string; label: string }[];
	emailRouting: boolean;
	autoRedirectProviderId: string | null;
}

export const buildSsoLoginOptions = (
	providers: { providerId: string; displayName: string | null }[],
	ssoRequired: boolean,
): SsoLoginOptions => {
	if (providers.length === 0) {
		return { buttons: [], emailRouting: false, autoRedirectProviderId: null };
	}
	if (providers.length > MAX_SSO_BUTTONS) {
		return { buttons: [], emailRouting: true, autoRedirectProviderId: null };
	}
	return {
		buttons: providers.map((p) => ({
			providerId: p.providerId,
			label: p.displayName?.trim() || p.providerId,
		})),
		emailRouting: false,
		autoRedirectProviderId:
			ssoRequired && providers.length === 1
				? (providers[0]?.providerId ?? null)
				: null,
	};
};

export const getSsoLoginOptions = async (ssoRequired: boolean) => {
	const rows = await db
		.select({
			providerId: ssoProvider.providerId,
			displayName: forkSsoSettings.displayName,
			enabled: forkSsoSettings.enabled,
		})
		.from(ssoProvider)
		.leftJoin(
			forkSsoSettings,
			eq(forkSsoSettings.providerId, ssoProvider.providerId),
		)
		.orderBy(ssoProvider.createdAt);
	return buildSsoLoginOptions(
		rows.filter((row) => row.enabled !== false),
		ssoRequired,
	);
};

/** Active providers; a provider without fork settings predates them and counts as active. */
export const listActiveSsoProviders = async () => {
	const rows = await db
		.select({
			providerId: ssoProvider.providerId,
			domain: ssoProvider.domain,
			enabled: forkSsoSettings.enabled,
		})
		.from(ssoProvider)
		.leftJoin(
			forkSsoSettings,
			eq(forkSsoSettings.providerId, ssoProvider.providerId),
		);
	return rows.filter((row) => row.enabled !== false);
};

export const emailMatchesDomains = (email: string, domains: string) => {
	const emailDomain = email.split("@")[1]?.trim().toLowerCase();
	if (!emailDomain) return false;
	return domains
		.split(",")
		.map((domain) => domain.trim().toLowerCase())
		.some(
			(domain) => emailDomain === domain || emailDomain.endsWith(`.${domain}`),
		);
};

export type SsoStartDecision =
	| { status: "not-applicable" }
	| { status: "allowed"; providerId: string }
	| { status: "refused"; reason: "inactive" | "no-provider" };

/**
 * Inactive providers must not be used to sign in, and email routing must pick the active one
 * when an inactive provider shares the domain.
 */
export const resolveSsoStart = async (
	path: string,
	body: { providerId?: unknown; email?: unknown } | undefined,
	params: { providerId?: string } | undefined,
): Promise<SsoStartDecision> => {
	const isStart = path.startsWith("/sign-in/sso");
	const isCallback = path.startsWith("/sso/callback");
	if (!isStart && !isCallback) return { status: "not-applicable" };
	const active = await listActiveSsoProviders();

	const providerId = isCallback ? params?.providerId : body?.providerId;
	if (typeof providerId === "string" && providerId) {
		return active.some((p) => p.providerId === providerId)
			? { status: "allowed", providerId }
			: { status: "refused", reason: "inactive" };
	}
	if (isStart && typeof body?.email === "string") {
		const email = body.email;
		const match = active.find((p) => emailMatchesDomains(email, p.domain));
		return match
			? { status: "allowed", providerId: match.providerId }
			: { status: "refused", reason: "no-provider" };
	}
	return { status: "not-applicable" };
};

export const defaultSsoRoleSettings: SsoRoleSettings = {
	groupsClaim: "groups",
	roleMappings: [],
	defaultRole: "member",
	requireMappedGroup: false,
};

/** Returns the role for these groups, or null when a mapped group is required and none matches. */
export const resolveSsoRole = (
	groups: string[],
	settings: SsoRoleSettings,
): SsoMappedRole | null => {
	const groupSet = new Set(groups);
	let best: SsoMappedRole | null = null;
	for (const mapping of settings.roleMappings) {
		if (!groupSet.has(mapping.group)) continue;
		if (!best || rolePriority[mapping.role] > rolePriority[best]) {
			best = mapping.role;
		}
	}
	if (best) return best;
	return settings.requireMappedGroup ? null : settings.defaultRole;
};

const decodeJwtPayload = (jwt: string): Record<string, unknown> | null => {
	const payload = jwt.split(".")[1];
	if (!payload) return null;
	try {
		return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
	} catch {
		return null;
	}
};

// Most providers send a list of names; Zitadel sends roles as an object keyed by role name.
const toGroupList = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value.filter((group): group is string => typeof group === "string");
	}
	if (value && typeof value === "object") return Object.keys(value);
	return [];
};

// The ID token was already validated by the SSO plugin; it is only decoded here to read the groups claim.
export const readGroupsClaim = (
	claim: string,
	idToken: string | undefined,
	userInfo: Record<string, unknown>,
): string[] => {
	const fromToken = idToken ? decodeJwtPayload(idToken)?.[claim] : undefined;
	if (fromToken !== undefined) return toGroupList(fromToken);
	return toGroupList(userInfo[claim]);
};

export const getSsoRoleSettings = async (
	providerId: string,
): Promise<SsoRoleSettings> => {
	const row = await db.query.forkSsoSettings.findFirst({
		where: eq(forkSsoSettings.providerId, providerId),
	});
	return row
		? {
				groupsClaim: row.groupsClaim,
				roleMappings: row.roleMappings,
				defaultRole: row.defaultRole,
				requireMappedGroup: row.requireMappedGroup,
			}
		: defaultSsoRoleSettings;
};

export type SsoMembershipResult =
	| { status: "owner" }
	| { status: "set"; role: SsoMappedRole }
	| { status: "refused" };

/**
 * Makes the user's membership in the provider's organization match their current groups.
 * Owners are never changed. When a mapped group is required and none matches, a non-owner
 * membership is removed so leavers lose access.
 */
export const syncSsoMembership = async ({
	userId,
	organizationId,
	groups,
	settings,
}: {
	userId: string;
	organizationId: string;
	groups: string[];
	settings: SsoRoleSettings;
}): Promise<SsoMembershipResult> => {
	const existing = await db.query.member.findFirst({
		where: and(
			eq(member.userId, userId),
			eq(member.organizationId, organizationId),
		),
	});
	if (existing?.role === "owner") return { status: "owner" };

	const role = resolveSsoRole(groups, settings);
	if (!role) {
		if (existing) {
			await db.delete(member).where(eq(member.id, existing.id));
		}
		return { status: "refused" };
	}

	if (!existing) {
		await db.insert(member).values({
			userId,
			organizationId,
			role,
			createdAt: new Date(),
			isDefault: true,
		});
	} else if (existing.role !== role) {
		await db.update(member).set({ role }).where(eq(member.id, existing.id));
	}
	return { status: "set", role };
};

/**
 * Linking an SSO identity to an existing account hands that account to whoever runs the identity
 * provider, so it is allowed only for people who already belong to the provider's organization
 * (or to none yet). This stops one organization's provider from taking over another's users.
 */
export const isSsoAccountLinkAllowed = async (
	userId: string,
	providerId: string,
): Promise<boolean> => {
	const provider = await db.query.ssoProvider.findFirst({
		where: eq(ssoProvider.providerId, providerId),
		columns: { organizationId: true },
	});
	if (!provider) return true;
	const memberships = await db.query.member.findMany({
		where: eq(member.userId, userId),
		columns: { organizationId: true },
	});
	if (memberships.length === 0) return true;
	return memberships.some((m) => m.organizationId === provider.organizationId);
};

const nonPasswordSignInPaths = [
	"/sign-in/social",
	"/sign-in/passkey",
	"/sign-up/email",
	"/passkey/verify-authentication",
	"/passkey/generate-authenticate-options",
];

const findOwnerByEmail = async (email: unknown) => {
	if (typeof email !== "string" || !email) return null;
	const found = await db.query.user.findFirst({
		where: eq(user.email, email.trim().toLowerCase()),
		columns: { id: true, email: true },
	});
	if (!found) return null;
	const membership = await db.query.member.findFirst({
		where: and(eq(member.userId, found.id), eq(member.role, "owner")),
		columns: { organizationId: true },
	});
	return membership
		? {
				userId: found.id,
				email: found.email,
				organizationId: membership.organizationId,
			}
		: null;
};

export type SsoOnlyDecision =
	| { status: "not-applicable" }
	| { status: "refused" }
	| {
			status: "owner-break-glass";
			owner: { userId: string; email: string; organizationId: string };
	  };

/**
 * With SSO required, every non-SSO way in is refused except an owner's password sign-in,
 * which stays open so a broken identity provider cannot lock the organization out.
 */
export const checkSsoOnlySignIn = async (
	path: string,
	email: unknown,
	isSsoRequired: () => Promise<boolean>,
): Promise<SsoOnlyDecision> => {
	const isPasswordSignIn = path.startsWith("/sign-in/email");
	const isOtherSignIn = nonPasswordSignInPaths.some((p) => path.startsWith(p));
	if (!isPasswordSignIn && !isOtherSignIn) return { status: "not-applicable" };
	if (!(await isSsoRequired())) return { status: "not-applicable" };
	if (!isPasswordSignIn) return { status: "refused" };
	const owner = await findOwnerByEmail(email);
	return owner ? { status: "owner-break-glass", owner } : { status: "refused" };
};
