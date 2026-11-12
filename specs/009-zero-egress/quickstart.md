# Quickstart: Verify Zero Egress

## 1. Static checks

```bash
pnpm typecheck && pnpm server:build && pnpm check:egress
pnpm --filter=dokploy exec vitest run --config __test__/vitest.config.ts
grep -rniE "posthog|hubspot|googletagmanager|openpanel|gravatar|stripe|ifconfig|icanhazip|ipecho|public-ip" \
  apps/dokploy packages/server/src --include=*.ts --include=*.tsx -l --exclude-dir=node_modules --exclude-dir=__test__
```

Expected: all pass; the grep finds nothing.

## 2. Runtime egress log (server)

Start the dev server with the egress hook from 001 (`NODE_OPTIONS=--require egress-log.cjs`), no
integrations configured. As owner: sign up, sign in, create a project, deploy `nginx:alpine` with a
domain, open every settings page, the profile page, templates and Swagger.

Expected: the log contains only `registry.npmjs.org` (Next.js dev-mode check, absent in production).

## 3. Browser

Open DevTools → Network with "All" and reload each main page. Expected: every request goes to the
platform's origin; the response headers carry the CSP from research R5.

## 4. CI gate

Add `fetch("https://example-tracker.invalid")` to any shipped file and run `pnpm check:egress`.
Expected: fails naming the host and file. Revert.

## 5. Upgrade

Restore a database from the 001 build, start this build, sign in. Expected: projects, apps, domains,
users and settings intact.
