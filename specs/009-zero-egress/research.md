# Research: Zero Egress

## R1. Inventory method

**Decision**: Three sources: a grep of shipped code for `https?://` hosts, `fetch(`, `curl`/`wget`,
`<Script src>` and tracking imports; a runtime hook logging every socket connect, DNS lookup and
spawned `curl`/`wget` from the server process while the app was exercised; a review of client
libraries that can load from CDNs.

**Findings** (2026-11-12, canary `98161fbe8`):

| Destination | Source | Action |
|---|---|---|
| `us.i.posthog.com` (built-in key) | server `utils/tracking/posthog.ts`, browser `posthog-js` | Delete |
| HubSpot forms API, `js-eu1.hs-scripts.com` | `utils/tracking/hubspot.ts`, `analytics.tsx` | Delete |
| `www.googletagmanager.com` | `analytics.tsx` | Delete |
| `openpanel.dokploy.com` | `analytics.tsx` | Delete |
| `www.gravatar.com` | `profile-form.tsx` | Delete |
| Stripe API | `server/utils/stripe*.ts`, `routers/stripe.ts`, webhook | Delete |
| `SERVER_URL`, `JOBS_URL` (Cloud job services) | `server/utils/deploy.ts`, `backup.ts` | Delete; local queue only |
| Inngest | `apps/api` | Delete app |
| `hub.docker.com` tags | `services/settings.ts` `getUpdateData` | Delete |
| `dokploy/dokploy` image pull | `updateServer`, restart of the `dokploy` service | Delete update; restart without `--image` |
| `templates.dokploy.com` | `templates/github.ts` | No default |
| `ifconfig.io`, `ifconfig.me`, `icanhazip.com`, `ipecho.net`, `public-ip` | `server-setup.ts`, `domain.ts`, `wss/utils.ts` | Delete |
| `raw.githubusercontent.com` logos | emails | Remove images |
| `dokploy.com/security/*.sh` | log text in `auth-secret.ts`, `db/constants.ts` | Reword |
| `validator.swagger.io` | Swagger UI default | `validatorUrl: null` |
| Next.js telemetry | build | `NEXT_TELEMETRY_DISABLED=1` |
| `registry.npmjs.org` | Next.js dev server only | None (dev only) |

Fonts come from `next/font/google`, which downloads at build time and serves locally.

## R2. Cloud mode: delete or disable

**Decision**: `export const IS_CLOUD = false` (a constant, not an env read), and delete every module
whose job is contacting a vendor or Cloud service.

**Rationale**: The ~130 Cloud branches only do something when `IS_CLOUD` is true. With it constant
and the vendor modules deleted, those branches cannot run and cannot reach anything. Deleting the
branches themselves would touch ~130 files and conflict on every upstream sync (Principle III).

**Alternative rejected**: Removing all Cloud branches now. Can be done gradually later.

## R3. Server address without lookups

**Decision**: The web server's IP comes from `SERVER_IP` (new, optional) or stays empty for the
admin to enter in Settings (the existing "Update server IP" control). Remote servers already store
`ipAddress`; Swarm init uses `ADVERTISE_ADDR` or that address. The `get_ip` shell function and the
`public-ip` library are deleted; `DISABLE_PUBLIC_IP_LOOKUP` from 001 becomes unnecessary and is
removed.

## R4. Update and restart

**Decision**: Delete `getUpdateData`, `updateServer`, the update badge and dialog. "Reload" of the
`dokploy` service runs `docker service update --force dokploy` without `--image`, so it restarts
the current image instead of pulling upstream's. `DISABLE_UPDATE_CHECK` is removed.

## R5. Content-Security-Policy

**Decision**: One header for all routes:
`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:;
frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`.
In development, `'unsafe-eval'` is added to `script-src` for hot reload.

**Rationale**: The aim is "no other origin". Inline scripts (theme bootstrap) are same-origin.
`'self'` in `connect-src` covers same-origin WebSockets in current browsers.

**Note**: Operator-configured destinations are reached by the server, not the browser, so the
browser needs none. If a later feature needs one (SSO redirects are navigations, not fetches), it
is added explicitly.

## R6. CI allowlist

**Decision**: `scripts/check-egress.mjs` scans shipped code (`apps/dokploy/{pages,components,server,
lib,utils}`, `packages/server/src`, `apps/monitoring`, Dockerfiles; excluding tests and
`.md`) for `http(s)://host` and fails on any host not in `scripts/egress-allowlist.json`. Each
allowlist entry has a reason: `docs` (link only), `installer` (remote-server setup),
`operator-integration` (default for a field the operator fills in), `example` (placeholder text).
It runs in the `pull-request.yml` workflow and as `pnpm check:egress`.

## R7. Emails

**Decision**: Remove the remote logo `<Img>` from every email template. Delete the email
templates used only by billing (`invoice-notification`, `payment-failed`, `trial-expiring`,
`stripe-welcome`) and the unused react-email examples (`notion-magic-link`, `plaid-verify-identity`,
`vercel-invite-user`) with their images.
