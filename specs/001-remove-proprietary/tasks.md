# Tasks: Remove Proprietary Code and Phone-Home

**Input**: design documents in `specs/001-remove-proprietary/`

**Clean room rule for every task**: never open a file under a `proprietary/` path. Delete them
with `git rm -r`; fix callers from the Apache side only.

## Phase 1: Setup

- [x] T001 Install Node 24.22.1 and run `pnpm install --frozen-lockfile`; record baseline results of `pnpm typecheck` and `pnpm test` before any change

## Phase 2: Foundational

- [x] T002 Create `packages/server/src/services/fork/org.ts` with `getOrganizationOwnerId(orgId)` (reads `organization.ownerId`), `getOrganizationDefaultRole(orgId)` (stored default role if built-in or an existing `organization_role.role` for that org, else `"member"`) and `writeAuditLog(entry)` (insert into `audit_log`; catch and `console.error` failures, never throw), and export it from `packages/server/src/index.ts`
- [x] T003 Delete `packages/server/src/services/proprietary/`, `apps/dokploy/server/api/routers/proprietary/` and `apps/dokploy/components/proprietary/` with `git rm -r`, and remove the four `services/proprietary/*` exports from `packages/server/src/index.ts`

## Phase 3: User Story 1 – Run with no proprietary code (P1)

**Goal**: product builds and works with the folders gone. **Test**: quickstart steps 1, 2, 4 (first two bullets), 6.

- [x] T004 [US1] Remove the 7 proprietary routers from `apps/dokploy/server/api/root.ts`
- [x] T005 [US1] Replace `enterpriseProcedure` with an owner/admin-only check and drop the `hasValidLicense` import in `apps/dokploy/server/api/trpc.ts`; switch `updateRemoteServersOnly` and `updateEnforceSSO` in `apps/dokploy/server/api/routers/settings.ts`
- [x] T006 [P] [US1] Remove the license check from `resolveRole` in `packages/server/src/services/permission.ts`
- [x] T007 [P] [US1] Remove the license branch in `packages/server/src/services/server.ts` so members get `accessedServers`
- [x] T008 [P] [US1] Remove the license branch in `packages/server/src/services/git-provider.ts` so `accessedGitProviders` always applies
- [x] T009 [P] [US1] Remove license checks in `apps/dokploy/server/api/routers/organization.ts`, `user.ts`, `server.ts` and `git-provider.ts`
- [x] T010 [US1] In `packages/server/src/lib/auth.ts` use `getOrganizationDefaultRole` and `writeAuditLog`, and stop honouring `enforceSSO` (comment why)
- [x] T011 [P] [US1] Use `getOrganizationOwnerId` from the fork module in `apps/dokploy/server/utils/billing.ts`
- [x] T012 [P] [US1] Delete `apps/dokploy/pages/dashboard/settings/{license,sso,audit-logs,whitelabeling}.tsx` and remove their menu entries and the `licenseKey`/`whitelabeling` queries in `apps/dokploy/components/layouts/side.tsx`
- [x] T013 [P] [US1] Make `apps/dokploy/utils/hooks/use-whitelabeling.ts` return default branding without calling the API
- [x] T014 [P] [US1] Remove GitHub, Google and SSO sign-in buttons and the `sso.showSignInWithSSO` query from `apps/dokploy/pages/index.tsx`; remove the social buttons and showcase from `apps/dokploy/pages/register.tsx`
- [x] T015 [P] [US1] Remove `ManageCustomRoles` from `apps/dokploy/pages/dashboard/settings/users.tsx`
- [x] T016 [P] [US1] Remove the license query and `EnterpriseFeatureLocked` from `apps/dokploy/components/dashboard/settings/users/add-permissions.tsx` and `show-users.tsx`
- [x] T017 [P] [US1] Replace `api.customRole.all` in `add-invitation.tsx` and `change-role.tsx` (under `apps/dokploy/components/dashboard/settings/users/`) with the built-in roles
- [x] T018 [P] [US1] Hide the enforce-SSO toggle (`apps/dokploy/components/dashboard/settings/servers/actions/toggle-enforce-sso.tsx` and its parent)
- [x] T019 [US1] Update tests in `apps/dokploy/__test__/permissions/` and `apps/dokploy/__test__/git-provider/` to drop the license mock and assert licensed behaviour, keeping all denial cases

## Phase 4: User Story 2 – No phone-home (P1)

**Goal**: no vendor calls in self-hosted mode. **Test**: quickstart steps 3 and 4 (last bullet).

- [x] T020 [US2] Delete `packages/server/src/utils/crons/enterprise.ts`, its export in `packages/server/src/index.ts` and its start call in `apps/dokploy/server/server.ts`
- [x] T021 [P] [US2] `DISABLE_UPDATE_CHECK=true` makes `getUpdateData` in `packages/server/src/services/settings.ts` return "no update" without fetching
- [x] T022 [P] [US2] Read the default templates base URL from `TEMPLATES_URL` in `packages/server/src/templates/github.ts` and the template UI (`apps/dokploy/components/dashboard/project/add-template.tsx`, onboarding `deploy-step.tsx`); empty disables
- [x] T023 [P] [US2] `DISABLE_PUBLIC_IP_LOOKUP=true` skips public-IP services in `packages/server/src/wss/utils.ts`, `packages/server/src/setup/server-setup.ts` and `packages/server/src/services/domain.ts`
- [x] T024 [P] [US2] Add a Vitest test that the update check, template fetch and IP lookup make no network call when disabled

## Phase 5: User Story 3 – Upgrade without loss (P2)

**Test**: quickstart step 5.

- [x] T025 [US3] Confirm `git diff` touches nothing under `apps/dokploy/drizzle/` or `packages/server/src/db/schema/`
- [x] T026 [US3] Replace the forward-auth toggle in `apps/dokploy/components/dashboard/application/domains/handle-forward-auth.tsx` with a disable-only control using the open domain update route

## Phase 6: User Story 4 – Audit trail keeps recording (P3)

**Test**: quickstart step 4 (audit bullet).

- [x] T027 [US4] Point `apps/dokploy/server/api/utils/audit.ts` at `writeAuditLog`
- [x] T028 [P] [US4] Add a Vitest test that `writeAuditLog` swallows a database error

## Phase 7: Polish

- [x] T029 Run `pnpm typecheck`, `pnpm format-and-lint` and `pnpm test`; fix failures
- [x] T030 Run the quickstart grep checks; document the env vars and the member server-access behaviour change in `docs/fork/001-release-notes.md`

## Dependencies

T001 → T002 → T003 → everything else. US1 tasks must finish before T029. US2–US4 depend only on
T003. [P] tasks touch different files.

## Implementation Strategy

MVP is Phases 1–4 (both P1 stories). Phases 5–6 are small and ship in the same PR.
