import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildContentSecurityPolicy } from "@/server/utils/csp";

const { fetchTemplatesList, fetchTemplateFiles, getTemplatesBaseUrl } =
	await import("@dokploy/server/templates/github");
const { setupSwarm } = await import("@dokploy/server/setup/server-setup");

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
	fetchSpy.mockReset();
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.resetModules();
});

describe("template catalog", () => {
	it("has no built-in catalog", async () => {
		vi.stubEnv("TEMPLATES_URL", undefined);
		expect(getTemplatesBaseUrl()).toBe("");
		await expect(fetchTemplatesList()).rejects.toThrow(/TEMPLATES_URL/);
		await expect(fetchTemplateFiles("x")).rejects.toThrow(/TEMPLATES_URL/);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("uses the operator's catalog", async () => {
		vi.stubEnv("TEMPLATES_URL", "https://templates.internal");
		fetchSpy.mockResolvedValue(new Response("[]", { status: 200 }));
		await fetchTemplatesList();
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://templates.internal/meta.json",
			expect.anything(),
		);
	});
});

describe("hosted-service mode", () => {
	it("stays off even when IS_CLOUD is set", async () => {
		vi.stubEnv("IS_CLOUD", "true");
		vi.resetModules();
		const { IS_CLOUD } = await import("@dokploy/server/constants");
		expect(IS_CLOUD).toBe(false);
	});
});

describe("swarm advertise address", () => {
	it("uses the supplied address and never looks one up", () => {
		const script = setupSwarm("10.0.1.5");
		expect(script).toContain('advertise_addr="${ADVERTISE_ADDR:-10.0.1.5}"');
		expect(script).not.toMatch(/ifconfig|icanhazip|ipecho/);
	});

	it("fails instead of looking up an address when none is set", () => {
		const script = setupSwarm();
		expect(script).toContain("exit 1");
		expect(script).not.toMatch(/curl/);
	});
});

describe("content security policy", () => {
	it("only allows the platform's own origin", () => {
		const policy = buildContentSecurityPolicy({ dev: false });
		expect(policy).toContain("default-src 'self'");
		expect(policy).toContain("connect-src 'self'");
		expect(policy).toContain("script-src 'self' 'unsafe-inline';");
		expect(policy).not.toMatch(/unsafe-eval/);
		expect(policy).not.toMatch(/https:\/\//);
	});

	it("adds the operator's template catalog for images only", () => {
		const policy = buildContentSecurityPolicy({
			dev: false,
			templatesUrl: "https://templates.internal/catalog",
		});
		expect(policy).toContain(
			"img-src 'self' data: blob: https://templates.internal",
		);
		expect(policy).toContain("connect-src 'self';");
	});

	it("allows eval only in development", () => {
		expect(buildContentSecurityPolicy({ dev: true })).toContain(
			"'unsafe-eval'",
		);
	});
});

describe("shipped code", () => {
	const roots = [
		"../../packages/server/src",
		"components",
		"pages",
		"server",
		"lib",
	];
	const forbidden =
		/posthog|hubspot|googletagmanager|openpanel|gravatar|from "stripe"|@stripe\/|ifconfig\.(io|me)|icanhazip|ipecho|public-ip"|app\.chatwoot\.com/i;

	const walk = (dir: string, out: string[] = []) => {
		for (const entry of readdirSync(dir)) {
			if (entry === "node_modules" || entry === "__test__") continue;
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) walk(path, out);
			else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(path);
		}
		return out;
	};

	it("contains no tracking, billing or IP-lookup services", () => {
		const offenders = roots
			.flatMap((root) => walk(join(__dirname, "../..", root)))
			.filter((file) => forbidden.test(readFileSync(file, "utf8")));
		expect(offenders).toEqual([]);
	});
});

describe("traefik", () => {
	it("pins the version check and usage report off in new configs", async () => {
		const { getDefaultTraefikConfig, getDefaultServerTraefikConfig } =
			await import("@dokploy/server/setup/traefik-setup");
		for (const yaml of [
			getDefaultTraefikConfig(),
			getDefaultServerTraefikConfig(),
			getDefaultServerTraefikConfig(false),
		]) {
			expect(yaml).toContain("checkNewVersion: false");
			expect(yaml).toContain("sendAnonymousUsage: false");
		}
	});

	it("rewrites an existing local config that lacks the flags", async () => {
		const { disableTraefikPhoneHome } = await import(
			"@dokploy/server/setup/traefik-setup"
		);
		const updated = disableTraefikPhoneHome(
			"global:\n  sendAnonymousUsage: false\nentryPoints:\n  web:\n    address: :80\n",
		);
		expect(updated).toContain("checkNewVersion: false");
		expect(updated).toContain("address: :80");
		expect(disableTraefikPhoneHome(updated ?? "")).toBeNull();
	});

	it("rewrites an existing remote config with the setup script", async () => {
		const { execFileSync } = await import("node:child_process");
		const { mkdtempSync, readFileSync, writeFileSync } = await import(
			"node:fs"
		);
		const { tmpdir } = await import("node:os");
		const { disableTraefikPhoneHomeScript } = await import(
			"@dokploy/server/setup/server-setup"
		);
		const dir = mkdtempSync(join(tmpdir(), "traefik-"));
		const cases = [
			"providers:\n  docker:\n    exposedByDefault: false\n",
			"global:\n  checkNewVersion: true\n  sendAnonymousUsage: false\nproviders: {}\n",
			"global: {}\nproviders: {}\n",
		];
		for (const [index, original] of cases.entries()) {
			const file = join(dir, `traefik-${index}.yml`);
			writeFileSync(file, original);
			execFileSync("bash", ["-c", disableTraefikPhoneHomeScript(file)]);
			const result = readFileSync(file, "utf8");
			expect(result).toMatch(
				/^global:\n {2}checkNewVersion: false\n {2}sendAnonymousUsage: false\n/,
			);
			expect(result).not.toContain("checkNewVersion: true");
			expect(result.match(/^global:/gm)).toHaveLength(1);
			expect(result).toContain("providers:");
		}
	});
});
