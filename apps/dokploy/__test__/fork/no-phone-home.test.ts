import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("public-ip", () => ({
	publicIpv4: vi.fn(() => Promise.resolve("203.0.113.1")),
	publicIpv6: vi.fn(() => Promise.resolve("2001:db8::1")),
}));

const { getUpdateData } = await import("@dokploy/server/services/settings");
const { fetchTemplatesList, fetchTemplateFiles } = await import(
	"@dokploy/server/templates/github"
);
const { getPublicIpWithFallback } = await import("@dokploy/server/wss/utils");
const { setupSwarm } = await import("@dokploy/server/setup/server-setup");
const publicIp = await import("public-ip");

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
	fetchSpy.mockReset();
	vi.mocked(publicIp.publicIpv4).mockClear();
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("outbound calls can be disabled", () => {
	it("skips the update check", async () => {
		vi.stubEnv("DISABLE_UPDATE_CHECK", "true");
		const data = await getUpdateData("v0.31.0");
		expect(data).toEqual({ latestVersion: null, updateAvailable: false });
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("refuses to fetch templates when TEMPLATES_URL is empty", async () => {
		vi.stubEnv("TEMPLATES_URL", "");
		await expect(fetchTemplatesList()).rejects.toThrow(/disabled/);
		await expect(fetchTemplateFiles("x")).rejects.toThrow(/disabled/);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("uses TEMPLATES_URL as the catalog", async () => {
		vi.stubEnv("TEMPLATES_URL", "https://templates.internal");
		fetchSpy.mockResolvedValue(new Response("[]", { status: 200 }));
		await fetchTemplatesList();
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://templates.internal/meta.json",
			expect.anything(),
		);
	});

	it("skips public IP services", async () => {
		vi.stubEnv("DISABLE_PUBLIC_IP_LOOKUP", "true");
		expect(await getPublicIpWithFallback()).toBeNull();
		expect(publicIp.publicIpv4).not.toHaveBeenCalled();
	});

	it("advertises the given address instead of looking one up", () => {
		const script = setupSwarm("10.0.1.5");
		expect(script).toContain('advertise_addr="${ADVERTISE_ADDR:-10.0.1.5}"');
	});
});
