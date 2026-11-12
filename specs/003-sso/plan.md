# Implementation Plan: Single Sign-On

**Branch**: `003-sso` | **Date**: 2026-11-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-sso/spec.md`

## Summary

Build the operator-facing half of OIDC SSO on top of better-auth's MIT `sso` plugin, which already
handles discovery, the authorization-code flow, token validation and account linking. Add a
fork-owned tRPC router for provider management, a fork-owned settings table for group → role
mapping, role sync on every SSO sign-in, the sign-in page option, and SSO-only mode with an owner
break-glass. Test end to end against Authentik from `dev/authentik`.

## Technical Context

**Language/Version**: TypeScript 5, Node 24

**Primary Dependencies**: better-auth 1.6 with `@better-auth/sso` (MIT), tRPC, drizzle-orm

**Storage**: PostgreSQL; one new table `fork_sso_settings` (additive migration)

**Testing**: Vitest (unit, refused paths); end-to-end script against local Authentik 2026.8.5

**Target Platform**: Linux, Docker Swarm; identity provider reachable from the platform server

**Project Type**: pnpm monorepo web application

**Constraints**: Clean room (own requirements only); no outbound calls except to the configured
provider; upstream `sso_provider` table untouched

## Constitution Check

| Principle | Status | Notes |
|---|---|---|
| I. Clean room | Pass | Written from our spec; only MIT plugin and Apache code read |
| II. No phone-home | Pass | Only the configured issuer is contacted, by the server |
| III. Thin delta | Pass | Fork code in `services/fork/sso.ts`, `routers/fork-sso.ts`, own table and UI folder |
| IV. One migration chain | Pass | One additive migration |
| V. Multi-node | Pass | Sign-in is platform-only; no node-level change |
| VI. Verification gates | Pass | Refused-path tests; end-to-end against a real IdP |
| VII. Code style | Pass | |

## Project Structure

```text
packages/server/src/
├── db/schema/fork-sso.ts          # fork_sso_settings table
├── services/fork/sso.ts           # provider CRUD via auth.api, role resolution, sync
└── lib/auth.ts                    # provisionUser hook, SSO-only check, closed HTTP paths
apps/dokploy/
├── server/api/routers/fork-sso.ts # tRPC: providers, mappings, SSO-only
├── components/dashboard/settings/sso/  # settings screen
├── pages/dashboard/settings/sso.tsx
├── pages/index.tsx                # "Sign in with SSO"
└── drizzle/0199_*.sql             # migration
dev/authentik/                      # local IdP fixture
scripts/sso-e2e.mjs                 # end-to-end sign-in against Authentik
```

## Complexity Tracking

None.
