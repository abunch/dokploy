# 009 Zero Egress: Release Notes

The platform no longer contacts anyone you did not configure. Everything below was deleted, not
switched off.

## Removed

- **Analytics and tracking**: PostHog (server events and browser, including session replay),
  HubSpot (sign-up forms, contact deletion, chat widget), Google Tag Manager, OpenPanel, the
  Chatwoot widget, Gravatar avatars.
- **Billing**: Stripe server code, webhook, billing and invoice pages, trial banner, plan limits,
  the onboarding "pick a plan" step, billing emails.
- **Hosted-service (Cloud) services**: `apps/api` (Inngest), `apps/schedules`, their Dockerfiles
  and the workflow that pushed their images; deployments and backups no longer offload to
  `SERVER_URL`/`JOBS_URL`. Cloud mode is a constant `false`; `IS_CLOUD=true` does nothing.
- **Update check and self-update**: no Docker Hub tag lookup, no update badge or dialog. Restarting
  the platform service from Settings restarts the current image and never pulls
  `dokploy/dokploy`, which would have replaced this fork with upstream.
- **Template catalog default**: templates load only from `TEMPLATES_URL`; unset means none.
- **Public-IP lookups**: `public-ip`, `ifconfig.io`, `ifconfig.me`, `icanhazip.com` and
  `ipecho.net` are gone from the platform and from the remote-server setup script.
- **Email images** loaded from GitHub, and log messages telling operators to pipe scripts from
  the vendor's site.
- **Build telemetry**: `NEXT_TELEMETRY_DISABLED=1` in the image.
- **Development-only trusted origin** pointing at a third-party ngrok host.

## Pinned off

- **Traefik version check** (`checkNewVersion`), on by default upstream, and the usage report. New
  configs carry both as `false`; existing configs are rewritten (local on startup, remote on server
  setup, with a backup) and pick it up when Traefik next restarts.
- **better-auth telemetry**, set to disabled in code so environment variables cannot enable it.

See `docs/fork/instrumentation.md` for everything that still records or reports activity and why.

## Added

- Content-Security-Policy on every response: scripts, styles, fonts, images and connections only to
  the platform's own origin (images also from `TEMPLATES_URL` when set).
- `pnpm check:egress`, run in CI, with `scripts/egress-allowlist.json`.
- `docs/fork/outbound-destinations.md`: what is still allowed to leave, and when.

## Operator changes

| Before | Now |
|---|---|
| Server IP looked up on first sign-up | `SERVER_IP` env var, or set it in Settings → Web Server |
| Remote Swarm advertise address looked up | The server's IP address in Dokploy, or `ADVERTISE_ADDR`; setup stops with a message if neither is set |
| `DISABLE_UPDATE_CHECK`, `DISABLE_PUBLIC_IP_LOOKUP` | Removed; always off |
| Template catalog on by default | Off unless `TEMPLATES_URL` is set |
| In-app update | Deploy a new image yourself |

Existing users who picked a Gravatar avatar fall back to their initials. No database tables or
columns were changed.

## Verification

- Typecheck, server build, Biome (changed files) and Vitest pass; the 3 tests that need Nixpacks
  pass in CI only.
- Dev server with no switches set, every connection from the server process logged while signing
  in, opening every settings page, profile, templates, Swagger and redeploying an app: the only
  connection was Next.js's dev-mode version check to `registry.npmjs.org`, which production does
  not run.
- Browser on the same pages: 160 requests, all to the platform's own origin; no CSP violations.
