# Implementation Plan: Zero Egress

**Branch**: `009-zero-egress` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-zero-egress/spec.md`

## Summary

Delete every outbound call the operator did not configure. Analytics and tracking (PostHog,
HubSpot, Google Tag Manager, OpenPanel), Gravatar, Stripe billing, the Cloud job services
(`apps/api`, `apps/schedules`) and the code that offloads to them, the update check and
self-update, the default template catalog, public-IP lookups, and remote images in emails are
removed. Cloud mode becomes a constant `false`. A strict Content-Security-Policy stops the browser
contacting other origins, and a CI script fails on new external hosts in shipped code.

## Technical Context

**Language/Version**: TypeScript 5, Node 24 (CI), Next.js 16 pages router

**Primary Dependencies**: better-auth, tRPC, drizzle-orm, dockerode; removed: `posthog-js`,
`@openpanel/nextjs`, `stripe`, `@stripe/stripe-js`, `public-ip`

**Storage**: PostgreSQL; no schema change, no migration

**Testing**: Vitest (`apps/dokploy/__test__`), plus a runtime egress log (quickstart)

**Target Platform**: Linux, Docker Swarm (single and multi-node), remote servers over SSH

**Project Type**: pnpm monorepo web application

**Performance Goals**: No change

**Constraints**: Self-hosted install must run with egress limited to operator-configured
destinations; existing data untouched

**Scale/Scope**: About 70 files edited or deleted, 2 workspace apps and 3 Dockerfiles deleted

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Apache-only, clean room | Pass | Only Apache files edited or deleted; no `proprietary/` path involved |
| II. No phone-home | Pass | This feature enforces it: deletion plus CSP plus CI allowlist |
| III. Thin delta | Justified | Cloud mode is hard-wired off instead of deleting its ~130 branches, to keep upstream merges small (R2); deleted modules are whole files |
| IV. One migration chain | Pass | No migrations; Stripe and Cloud columns stay in the schema unused |
| V. Multi-node | Pass | Remote-server setup and Swarm init use operator-supplied addresses; verified on a remote server in 008 |
| VI. Verification gates | Pass | Tests for no network calls, CSP header, allowlist script; typecheck, server build, Biome, Vitest |
| VII. Code style | Pass | Comments only for the non-obvious (Cloud constant, CSP choices) |

Post-design re-check: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/009-zero-egress/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── outbound-destinations.md
│   └── removed-surface.md
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/, apps/schedules/                       # deleted (Cloud job services)
Dockerfile.cloud, Dockerfile.server, Dockerfile.schedule   # deleted
.github/workflows/deploy.yml                     # deleted (pushes Cloud images)
.github/workflows/pull-request.yml               # add egress allowlist step
scripts/check-egress.mjs, scripts/egress-allowlist.json    # new
Dockerfile                                       # NEXT_TELEMETRY_DISABLED=1

packages/server/src/
├── constants/index.ts            # IS_CLOUD = false
├── utils/tracking/               # deleted (posthog.ts, hubspot.ts)
├── lib/auth.ts                   # drop tracking, HubSpot, public-IP lookup
├── services/deployment.ts        # drop deployment tracking
├── services/settings.ts          # drop update check; restart without --image
├── services/domain.ts            # drop remote IP curl
├── setup/server-setup.ts         # drop get_ip lookups; require supplied address
├── wss/utils.ts                  # drop public-ip
├── templates/github.ts           # no default catalog URL
├── emails/emails/*.tsx           # drop remote logo images; delete unused/billing emails
├── lib/auth-secret.ts, db/constants.ts   # drop "curl dokploy.com" advice
└── index.ts                      # drop tracking exports

apps/dokploy/
├── components/shared/analytics.tsx            # deleted
├── pages/_app.tsx, lib/auth-client.ts         # drop analytics
├── server/utils/{stripe,stripe-notifications,trial-notifications,deploy,backup}.ts  # deleted
├── server/api/routers/stripe.ts, pages/api/stripe/  # deleted
├── components/dashboard/settings/billing/, components/dashboard/billing/  # deleted
├── components/layouts/update-server.tsx, settings/web-server/update-server.tsx  # deleted
├── server/api/routers/settings.ts             # drop getUpdateData, updateServer, PostHog config
├── components/dashboard/settings/profile/profile-form.tsx  # drop Gravatar
├── pages/swagger.tsx                          # validatorUrl null
├── next.config.mjs                            # full CSP
└── routers using server/utils/deploy|backup   # call local queue paths directly
```

**Structure Decision**: Whole-file deletions where a module's only job is contacting a vendor;
small edits at call sites; Cloud branches left in place behind a constant `false` (R2).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Cloud branches kept as dead code | ~130 files; deleting them makes every weekly upstream merge conflict | Deleting them all gives no extra egress guarantee once the constant is `false` and the vendor modules are gone |
