#!/usr/bin/env node
// Fails when shipped code references an external host that is not in scripts/egress-allowlist.json.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const allowlist = JSON.parse(
	readFileSync(join(root, "scripts/egress-allowlist.json"), "utf8"),
);

const scanRoots = [
	"apps/dokploy/pages",
	"apps/dokploy/components",
	"apps/dokploy/server",
	"apps/dokploy/lib",
	"apps/dokploy/utils",
	"apps/dokploy/hooks",
	"apps/dokploy/next.config.mjs",
	"apps/dokploy/setup.ts",
	"apps/dokploy/migration.ts",
	"packages/server/src",
	"apps/monitoring",
	"Dockerfile",
	"Dockerfile.monitoring",
];
const extensions = new Set([
	".ts",
	".tsx",
	".js",
	".mjs",
	".cjs",
	".go",
	".sh",
	"",
]);
const skipDirs = new Set([
	"node_modules",
	".next",
	"dist",
	"__test__",
	".docker",
]);

const files = [];
const walk = (path) => {
	let stat;
	try {
		stat = statSync(path);
	} catch {
		return;
	}
	if (stat.isDirectory()) {
		for (const entry of readdirSync(path)) {
			if (!skipDirs.has(entry)) walk(join(path, entry));
		}
	} else if (extensions.has(extname(path))) {
		files.push(path);
	}
};
for (const entry of scanRoots) walk(join(root, entry));

const hostPattern =
	/\bhttps?:\/\/([a-z0-9.-]+\.[a-z]{2,})(?=[/:"'`\s)\]},;?#]|$)/gi;
const isAllowed = (host) =>
	Object.hasOwn(allowlist, host) ||
	Object.keys(allowlist).some(
		(entry) => entry.startsWith("*.") && host.endsWith(entry.slice(1)),
	);

const violations = new Map();
for (const file of files) {
	const text = readFileSync(file, "utf8");
	for (const match of text.matchAll(hostPattern)) {
		const host = match[1].toLowerCase();
		if (isAllowed(host)) continue;
		const where = relative(root, file);
		if (!violations.has(host)) violations.set(host, new Set());
		violations.get(host).add(where);
	}
}

if (violations.size > 0) {
	console.error("External hosts not in scripts/egress-allowlist.json:");
	for (const [host, where] of [...violations].sort()) {
		console.error(`  ${host}`);
		for (const file of [...where].sort()) console.error(`    ${file}`);
	}
	process.exit(1);
}
console.log(`check-egress: ${files.length} files, no unlisted external hosts`);
