# Implementation Plan: Remove Proprietary Code and Phone-Home

**Branch**: `001-remove-proprietary` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-remove-proprietary/spec.md`

## Summary

Delete the three `proprietary/` folders (30 files) and repair the 20 Apache files that import
them. The key finding from research is that most "enterprise" behaviour (custom-role enforcement,
per-member server and git-provider access, forward-auth routing, SSO/SCIM sign-in through
better-auth's MIT plugins) is open code that is switched off by a license check. Removing the
check turns it on for everyone. Only the management screens and their API routes are proprietary,
so those are the parts that disappear. Five small fork-owned helpers replace the proprietary
functions that open code called. Vendor endpoints are removed or become environment-configurable.

## Technical Context

**Language/Version**: TypeScript 5, Node.js 24.22

**Primary Dependencies**: Next.js (pages router), tRPC, better-auth (with `@better-auth/sso` and
`@better-auth/scim`), Drizzle ORM, BullMQ, node-schedule

**Storage**: PostgreSQL via Drizzle; no schema changes in this feature

**Testing**: Vitest (`apps/dokploy/__test__`), `pnpm typecheck`, Biome

**Target Platform**: Linux server in Docker Swarm; self-hosted mode (`IS_CLOUD` unset)

**Project Type**: pnpm monorepo web application (`apps/dokploy` UI + API, `packages/server` core)

**Performance Goals**: no change; permission checks drop one database read (license lookup)

**Constraints**: clean room (no proprietary file opened); no destructive migration; thin delta

**Scale/Scope**: 30 files deleted, about 20 files edited, 1 new module, about 6 tests changed

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Apache-only, clean room | Pass | Folders deleted unread; replacements written from Apache call sites and schema only (see research R1) |
| II. No phone-home | Pass | License cron deleted; update check, templates, IP lookup made configurable; cloud analytics unreachable in self-hosted mode (R5) |
| III. Thin delta | Pass | Edits limited to import sites; replacements in one new file `packages/server/src/services/fork/org.ts` |
| IV. One migration chain | Pass | No migrations |
| V. Multi-node | Pass | No deploy-path changes; per-member server access applies to remote servers (tested) |
| VI. Verification gates | Pass | Denial tests kept for built-in and custom roles; new tests for member scoping without a license |
| VII. Code style | Pass | Comments only on non-obvious choices (enforceSSO ignored) |

Post-design re-check: unchanged, no violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-remove-proprietary/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api-removed.md
│   └── env.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/server/src/
├── services/proprietary/          # deleted
├── services/fork/org.ts           # new: owner lookup, default role, audit writer
├── services/permission.ts         # drop license check
├── services/server.ts             # drop license check
├── services/git-provider.ts       # drop license check
├── lib/auth.ts                    # use fork helpers; ignore enforceSSO
├── utils/crons/enterprise.ts      # deleted
├── services/settings.ts           # update check env switch
├── templates/github.ts            # templates base URL from env
├── setup/server-setup.ts          # skip IP lookup when address given
├── services/domain.ts             # same
├── wss/utils.ts                   # same
└── index.ts                       # drop proprietary exports

apps/dokploy/
├── server/api/routers/proprietary/   # deleted
├── server/api/root.ts                # drop 7 routers
├── server/api/trpc.ts                # enterpriseProcedure → owner/admin only
├── server/api/utils/audit.ts         # use fork audit writer
├── server/api/routers/{organization,user,server,git-provider,settings}.ts
├── server/server.ts                  # drop license cron start
├── server/utils/billing.ts           # fork owner lookup
├── components/proprietary/           # deleted
├── components/dashboard/settings/users/{add-permissions,show-users,add-invitation,change-role}.tsx
├── components/dashboard/application/domains/handle-forward-auth.tsx
├── components/dashboard/settings/servers/actions/toggle-enforce-sso.tsx (+ its parent)
├── components/layouts/side.tsx
├── utils/hooks/use-whitelabeling.ts
├── pages/index.tsx, pages/register.tsx
└── pages/dashboard/settings/{license,sso,audit-logs,whitelabeling}.tsx   # deleted
```

**Structure Decision**: existing monorepo layout. All fork-owned replacement code lives in
`packages/server/src/services/fork/` so upstream syncs conflict only at import lines.

## Complexity Tracking

No violations.
