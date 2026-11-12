# Tasks: Single Sign-On

## Phase 1: Setup

- [x] T001 Local Authentik fixture in `dev/authentik/` with groups `dokploy-admins`, `dokploy-developers` and users alice, bob, carol
- [x] T002 Table `fork_sso_settings` in `packages/server/src/db/schema/fork-sso.ts`, exported from the schema index, plus a generated migration in `apps/dokploy/drizzle/`

## Phase 2: Foundational

- [x] T003 `packages/server/src/services/fork/sso.ts`: `resolveSsoRole(groups, settings)`, `readGroupsClaim(token, userInfo, claim)`, `syncSsoMembership(...)`, provider CRUD wrappers around `auth.api` that add the issuer origin to the owner's trusted origins and enforce platform-wide domain uniqueness
- [x] T004 In `packages/server/src/lib/auth.ts`: `sso({ trustEmailVerified: true, provisionUser, provisionUserOnEveryLogin: true })`; add the plugin's register/update/delete/get/list/domain-verification paths to `disabledPaths`

## Phase 3: US1 – Connect a provider (P1)

- [x] T005 [US1] `apps/dokploy/server/api/routers/fork-sso.ts` with the procedures in `contracts/trpc.md`; register in `root.ts`; audit every change
- [x] T006 [US1] Settings page `apps/dokploy/pages/dashboard/settings/sso.tsx` and components in `apps/dokploy/components/dashboard/settings/sso/` (list, add/edit dialog with mappings, delete); sidebar entry for owners and admins

## Phase 4: US2 – Sign in with SSO (P1)

- [x] T007 [US2] "Sign in with SSO" on `apps/dokploy/pages/index.tsx`: email field, `authClient.signIn.sso`, error for domains with no provider

## Phase 5: US3 – Roles follow groups (P1)

- [x] T008 [US3] Vitest for `resolveSsoRole` and `syncSsoMembership`: highest role wins, default role, require-group refusal removes membership, owner never changed, removed member re-added

## Phase 6: US4 – SSO-only (P2)

- [x] T009 [US4] Restore the blocked-path check in `auth.ts` honouring `enforceSSO` with an owner exception for `/sign-in/email`; audit owner break-glass sign-ins
- [x] T010 [US4] SSO-only switch on the SSO settings page (owner only, needs a provider); sign-in page shows SSO first when on
- [x] T011 [US4] Vitest for the SSO-only gate: non-owner refused, owner allowed, sign-up refused

## Phase 7: Polish

- [x] T012 `scripts/sso-e2e.mjs`: sign in through Authentik as alice/bob/carol and check roles; check SSO-only refusals
- [x] T013 Typecheck, server build, Biome on changed files, Vitest, `check:egress`; release notes `docs/fork/003-release-notes.md`
