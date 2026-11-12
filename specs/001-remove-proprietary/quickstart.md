# Quickstart: Validate Feature 001

Prerequisites: Node 24.22, pnpm, Docker.

1. `pnpm install && pnpm typecheck && pnpm format-and-lint && pnpm test` – all pass.
2. Clean room and removal check – both commands print nothing:
   - `find . -path ./node_modules -prune -o -type d -name proprietary -print`
   - `grep -rn "proprietary/" apps packages --include=*.ts --include=*.tsx`
3. Phone-home check – prints nothing:
   `grep -rn "licenses-api.dokploy.com" apps packages`
4. Run locally (`pnpm dokploy:setup && pnpm dokploy:dev`) with `DISABLE_UPDATE_CHECK=true`,
   `DISABLE_PUBLIC_IP_LOOKUP=true` and `TEMPLATES_URL=`. Then:
   - Register the owner, create a project and deploy an application with a domain. No license
     prompt or lock appears anywhere in settings.
   - Invite a member, assign one server, sign in as the member: only that server is visible;
     server actions outside the member's permissions are refused.
   - Sign out and back in; confirm login and logout rows in `audit_log`.
   - With outbound traffic logged (for example `docker run --network` with a logging proxy, or
     `tcpdump` on the host), open every dashboard page: no request to `*.dokploy.com`,
     `hub.docker.com`, PostHog, OpenPanel, GTM, HubSpot or IP lookup services.
5. Upgrade test: restore a database dump from the latest upstream release (with an SSO provider,
   a custom role and audit entries), start the fork, confirm migrations run, all rows remain, and
   the custom-role user keeps the same permissions.
6. Old settings URLs (`/dashboard/settings/license`, `/sso`, `/audit-logs`, `/whitelabeling`)
   show the not-found page.
