import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => {
	const values = vi.fn().mockResolvedValue(undefined);
	const where = vi.fn().mockResolvedValue(undefined);
	return {
		values,
		where,
		insert: vi.fn(() => ({ values })),
		update: vi.fn(() => ({ set: vi.fn(() => ({ where })) })),
		delete: vi.fn(() => ({ where })),
		query: {
			member: { findFirst: vi.fn() },
			user: { findFirst: vi.fn() },
			forkSsoSettings: { findFirst: vi.fn() },
		},
	};
});

vi.mock("@dokploy/server/db", () => ({ db: mockDb }));

const {
	buildSsoLoginOptions,
	checkSsoOnlySignIn,
	readGroupsClaim,
	resolveSsoRole,
	syncSsoMembership,
	defaultSsoRoleSettings,
} = await import("@dokploy/server/services/fork/sso-roles");
const { findDomainConflict, normalizeDomains } = await import(
	"@dokploy/server/services/fork/sso-providers"
);

const settings = {
	...defaultSsoRoleSettings,
	roleMappings: [
		{ group: "dokploy-admins", role: "admin" as const },
		{ group: "dokploy-developers", role: "member" as const },
	],
};

const jwt = (payload: Record<string, unknown>) =>
	`header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

beforeEach(() => {
	vi.clearAllMocks();
});

describe("resolveSsoRole", () => {
	it("gives the highest mapped role", () => {
		expect(
			resolveSsoRole(["dokploy-developers", "dokploy-admins"], settings),
		).toBe("admin");
		expect(resolveSsoRole(["dokploy-developers"], settings)).toBe("member");
	});

	it("falls back to the default role when no group matches", () => {
		expect(resolveSsoRole(["other"], settings)).toBe("member");
		expect(resolveSsoRole([], { ...settings, defaultRole: "admin" })).toBe(
			"admin",
		);
	});

	it("refuses when a mapped group is required and none matches", () => {
		expect(
			resolveSsoRole(["other"], { ...settings, requireMappedGroup: true }),
		).toBeNull();
	});
});

describe("readGroupsClaim", () => {
	it("reads the claim from the ID token", () => {
		expect(readGroupsClaim("groups", jwt({ groups: ["a", "b"] }), {})).toEqual([
			"a",
			"b",
		]);
	});

	it("falls back to user info and ignores non-string entries", () => {
		expect(readGroupsClaim("roles", undefined, { roles: ["x", 3] })).toEqual([
			"x",
		]);
	});

	it("treats a missing or malformed claim as no groups", () => {
		expect(readGroupsClaim("groups", jwt({}), {})).toEqual([]);
		expect(readGroupsClaim("groups", "not-a-jwt", { groups: "admin" })).toEqual(
			[],
		);
	});
});

describe("syncSsoMembership", () => {
	const base = { userId: "u1", organizationId: "org-1", settings };

	it("never changes an owner", async () => {
		mockDb.query.member.findFirst.mockResolvedValue({
			id: "m1",
			role: "owner",
		});
		const result = await syncSsoMembership({ ...base, groups: [] });
		expect(result).toEqual({ status: "owner" });
		expect(mockDb.update).not.toHaveBeenCalled();
		expect(mockDb.delete).not.toHaveBeenCalled();
	});

	it("raises a member to admin from their groups", async () => {
		mockDb.query.member.findFirst.mockResolvedValue({
			id: "m1",
			role: "member",
		});
		const result = await syncSsoMembership({
			...base,
			groups: ["dokploy-admins"],
		});
		expect(result).toEqual({ status: "set", role: "admin" });
		expect(mockDb.update).toHaveBeenCalled();
	});

	it("lowers an admin who left the admin group", async () => {
		mockDb.query.member.findFirst.mockResolvedValue({
			id: "m1",
			role: "admin",
		});
		const result = await syncSsoMembership({ ...base, groups: [] });
		expect(result).toEqual({ status: "set", role: "member" });
		expect(mockDb.update).toHaveBeenCalled();
	});

	it("adds back a person whose membership was removed", async () => {
		mockDb.query.member.findFirst.mockResolvedValue(undefined);
		await syncSsoMembership({ ...base, groups: ["dokploy-developers"] });
		expect(mockDb.values).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "u1", role: "member" }),
		);
	});

	it("removes access when a required group is missing", async () => {
		mockDb.query.member.findFirst.mockResolvedValue({
			id: "m1",
			role: "admin",
		});
		const result = await syncSsoMembership({
			...base,
			groups: [],
			settings: { ...settings, requireMappedGroup: true },
		});
		expect(result).toEqual({ status: "refused" });
		expect(mockDb.delete).toHaveBeenCalled();
	});
});

describe("domain ownership", () => {
	const others = [{ providerId: "corp", domain: "example.com,example.org" }];

	it("refuses an exact duplicate", () => {
		expect(findDomainConflict(["example.com"], others)?.providerId).toBe(
			"corp",
		);
	});

	it("refuses a subdomain or parent of another provider's domain", () => {
		expect(findDomainConflict(["eu.example.com"], others)).not.toBeNull();
		expect(
			findDomainConflict(["org"], [{ providerId: "x", domain: "a.org" }]),
		).not.toBeNull();
	});

	it("allows unrelated domains", () => {
		expect(findDomainConflict(["example.net"], others)).toBeNull();
		expect(findDomainConflict(["notexample.com"], others)).toBeNull();
	});

	it("normalizes case, spaces and duplicates", () => {
		expect(normalizeDomains([" Example.COM", "example.com", ""])).toEqual([
			"example.com",
		]);
	});
});

describe("SSO-only sign-in", () => {
	const required = () => Promise.resolve(true);
	const optional = () => Promise.resolve(false);

	it("does nothing when SSO is optional", async () => {
		expect(
			await checkSsoOnlySignIn("/sign-in/email", "bob@x.test", optional),
		).toEqual({ status: "not-applicable" });
	});

	it("ignores unrelated paths without reading settings", async () => {
		const isRequired = vi.fn(required);
		expect(
			await checkSsoOnlySignIn("/get-session", undefined, isRequired),
		).toEqual({ status: "not-applicable" });
		expect(isRequired).not.toHaveBeenCalled();
	});

	it("refuses a non-owner password sign-in", async () => {
		mockDb.query.user.findFirst.mockResolvedValue({
			id: "u2",
			email: "bob@x.test",
		});
		mockDb.query.member.findFirst.mockResolvedValue(undefined);
		expect(
			await checkSsoOnlySignIn("/sign-in/email", "bob@x.test", required),
		).toEqual({ status: "refused" });
	});

	it("refuses an unknown email", async () => {
		mockDb.query.user.findFirst.mockResolvedValue(undefined);
		expect(
			await checkSsoOnlySignIn("/sign-in/email", "nobody@x.test", required),
		).toEqual({ status: "refused" });
	});

	it("lets the owner use their password", async () => {
		mockDb.query.user.findFirst.mockResolvedValue({
			id: "u1",
			email: "owner@x.test",
		});
		mockDb.query.member.findFirst.mockResolvedValue({
			organizationId: "org-1",
		});
		expect(
			await checkSsoOnlySignIn("/sign-in/email", "Owner@X.test", required),
		).toEqual({
			status: "owner-break-glass",
			owner: { userId: "u1", email: "owner@x.test", organizationId: "org-1" },
		});
	});

	it("refuses sign-up, passkeys and social sign-in, even for owners", async () => {
		for (const path of [
			"/sign-up/email",
			"/sign-in/passkey",
			"/passkey/verify-authentication",
			"/sign-in/social",
		]) {
			expect(await checkSsoOnlySignIn(path, "owner@x.test", required)).toEqual({
				status: "refused",
			});
		}
	});
});

describe("sign-in page options", () => {
	const provider = (providerId: string, displayName: string | null = null) => ({
		providerId,
		displayName,
	});

	it("shows one button per provider, labelled by display name", () => {
		expect(
			buildSsoLoginOptions(
				[provider("corp", "Company SSO"), provider("partners")],
				false,
			).buttons,
		).toEqual([
			{ providerId: "corp", label: "Company SSO" },
			{ providerId: "partners", label: "partners" },
		]);
	});

	it("auto-redirects only when SSO is required and there is exactly one provider", () => {
		expect(
			buildSsoLoginOptions([provider("corp")], true).autoRedirectProviderId,
		).toBe("corp");
		expect(
			buildSsoLoginOptions([provider("corp")], false).autoRedirectProviderId,
		).toBeNull();
		expect(
			buildSsoLoginOptions([provider("a"), provider("b")], true)
				.autoRedirectProviderId,
		).toBeNull();
	});

	it("switches to email routing with many providers", () => {
		const many = ["a", "b", "c", "d"].map((id) => provider(id));
		expect(buildSsoLoginOptions(many, true)).toEqual({
			buttons: [],
			emailRouting: true,
			autoRedirectProviderId: null,
		});
	});

	it("shows nothing without providers", () => {
		expect(buildSsoLoginOptions([], true)).toEqual({
			buttons: [],
			emailRouting: false,
			autoRedirectProviderId: null,
		});
	});
});
