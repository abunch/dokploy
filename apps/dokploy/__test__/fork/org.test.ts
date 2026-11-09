import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
	insert: vi.fn(),
	query: {
		organization: { findFirst: vi.fn() },
		organizationRole: { findFirst: vi.fn() },
		server: { findMany: vi.fn() },
		member: { findFirst: vi.fn() },
	},
}));

vi.mock("@dokploy/server/db", () => ({ db: mockDb }));

const { getOrganizationDefaultRole, getOrganizationOwnerId, writeAuditLog } =
	await import("@dokploy/server/services/fork/org");
const { getAccessibleServerIds } = await import(
	"@dokploy/server/services/server"
);

const entry = {
	organizationId: "org-1",
	userId: "user-1",
	userEmail: "a@example.com",
	userRole: "admin",
	action: "update" as const,
	resourceType: "settings" as const,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("writeAuditLog", () => {
	it("inserts the entry with metadata serialized", async () => {
		const values = vi.fn().mockResolvedValue(undefined);
		mockDb.insert.mockReturnValue({ values });
		await writeAuditLog({ ...entry, metadata: { a: 1 } });
		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "user-1", metadata: '{"a":1}' }),
		);
	});

	it("does not throw when the insert fails", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		mockDb.insert.mockReturnValue({
			values: vi.fn().mockRejectedValue(new Error("db down")),
		});
		await expect(writeAuditLog(entry)).resolves.toBeUndefined();
		expect(error).toHaveBeenCalled();
		error.mockRestore();
	});
});

describe("getOrganizationDefaultRole", () => {
	it("falls back to member when no default is set", async () => {
		mockDb.query.organization.findFirst.mockResolvedValue({
			defaultRole: null,
		});
		expect(await getOrganizationDefaultRole("org-1")).toBe("member");
	});

	it("never hands out the owner role", async () => {
		mockDb.query.organization.findFirst.mockResolvedValue({
			defaultRole: "owner",
		});
		expect(await getOrganizationDefaultRole("org-1")).toBe("member");
	});

	it("returns a built-in default", async () => {
		mockDb.query.organization.findFirst.mockResolvedValue({
			defaultRole: "admin",
		});
		expect(await getOrganizationDefaultRole("org-1")).toBe("admin");
	});

	it("returns a custom default that still exists", async () => {
		mockDb.query.organization.findFirst.mockResolvedValue({
			defaultRole: "deployer",
		});
		mockDb.query.organizationRole.findFirst.mockResolvedValue({ id: "r1" });
		expect(await getOrganizationDefaultRole("org-1")).toBe("deployer");
	});

	it("falls back to member when the custom default was deleted", async () => {
		mockDb.query.organization.findFirst.mockResolvedValue({
			defaultRole: "deployer",
		});
		mockDb.query.organizationRole.findFirst.mockResolvedValue(undefined);
		expect(await getOrganizationDefaultRole("org-1")).toBe("member");
	});
});

describe("getOrganizationOwnerId", () => {
	it("returns null for an unknown organization", async () => {
		mockDb.query.organization.findFirst.mockResolvedValue(undefined);
		expect(await getOrganizationOwnerId("missing")).toBeNull();
	});
});

describe("getAccessibleServerIds without a license", () => {
	const session = { userId: "user-1", activeOrganizationId: "org-1" };

	beforeEach(() => {
		mockDb.query.server.findMany.mockResolvedValue([
			{ serverId: "s1" },
			{ serverId: "s2" },
		]);
	});

	it("limits a member to assigned servers", async () => {
		mockDb.query.member.findFirst.mockResolvedValue({
			role: "member",
			accessedServers: ["s1"],
		});
		expect([...(await getAccessibleServerIds(session))]).toEqual(["s1"]);
	});

	it("gives a member with no assignments no servers", async () => {
		mockDb.query.member.findFirst.mockResolvedValue({
			role: "member",
			accessedServers: [],
		});
		expect((await getAccessibleServerIds(session)).size).toBe(0);
	});

	it("gives an admin every server", async () => {
		mockDb.query.member.findFirst.mockResolvedValue({
			role: "admin",
			accessedServers: [],
		});
		expect((await getAccessibleServerIds(session)).size).toBe(2);
	});
});
