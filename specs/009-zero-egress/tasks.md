# Tasks: Zero Egress

**Input**: design documents in `specs/009-zero-egress/`

## Phase 1: Setup

- [ ] T001 Record baseline: `pnpm typecheck`, `pnpm server:build` (in `packages/server`: `tsc --project tsconfig.server.json --noEmit`) and Vitest results on `canary` `98161fbe8`

## Phase 2: Foundational

- [ ] T002 Set `export const IS_CLOUD = false` with a one-line reason in `packages/server/src/constants/index.ts`

## Phase 3: User Story 1 – Contacts nobody it was not told to (P1)

**Goal**: no analytics, tracking, billing, Cloud services or avatars. **Test**: quickstart 1–3.

- [ ] T003 [P] [US1] Delete `packages/server/src/utils/tracking/` and its exports in `packages/server/src/index.ts`; remove the HubSpot and PostHog calls in `packages/server/src/lib/auth.ts` and `packages/server/src/services/deployment.ts`
- [ ] T004 [P] [US1] Delete `apps/dokploy/components/shared/analytics.tsx`; remove its use in `apps/dokploy/pages/_app.tsx` and any tracking in `apps/dokploy/lib/auth-client.ts`; remove `settings.getPostHogConfig` in `apps/dokploy/server/api/routers/settings.ts`
- [ ] T005 [US1] Delete Stripe: `apps/dokploy/server/utils/{stripe,stripe-notifications,trial-notifications}.ts`, `apps/dokploy/server/api/routers/stripe.ts` (and its entry in `root.ts`), `apps/dokploy/pages/api/stripe/`, `apps/dokploy/components/dashboard/settings/billing/`, `apps/dokploy/components/dashboard/billing/`, the billing settings page and menu entry, onboarding plan step; fix remaining references in `user.ts`, `server.ts` routers, `account-deletion.ts`, `billing.ts`, `show-servers.tsx`, `handle-servers.tsx`, `server-step.tsx`, impersonation components, `dashboard-layout.tsx`, `scripts/reset-onboarding.ts`
- [ ] T006 [US1] Delete `apps/dokploy/server/utils/deploy.ts` and `backup.ts` (Cloud job offload) and make every caller in `apps/dokploy/server/api/routers/*` and `apps/dokploy/pages/api/deploy/*` use the local queue path; update the tests that mock them
- [ ] T007 [P] [US1] Delete `apps/api`, `apps/schedules`, `Dockerfile.cloud`, `Dockerfile.server`, `Dockerfile.schedule`, `.github/workflows/deploy.yml`; remove them from `pnpm-workspace.yaml`; refresh `pnpm-lock.yaml`
- [ ] T008 [P] [US1] Remove Gravatar from `apps/dokploy/components/dashboard/settings/profile/profile-form.tsx`
- [ ] T009 [P] [US1] Remove remote logo images from every template in `packages/server/src/emails/emails/`; delete billing-only and unused example emails and their `static/` images
- [ ] T010 [P] [US1] Remove the "curl dokploy.com/security" advice from `packages/server/src/lib/auth-secret.ts` and `packages/server/src/db/constants.ts`
- [ ] T011 [P] [US1] Set `validatorUrl={null}` in `apps/dokploy/pages/swagger.tsx`
- [ ] T012 [P] [US1] Make `TEMPLATES_URL` the only catalog source (no default) in `packages/server/src/templates/github.ts`; template UI shows "no catalog configured"
- [ ] T013 [P] [US1] Add `ENV NEXT_TELEMETRY_DISABLED=1` to `Dockerfile` build and run stages
- [ ] T014 [US1] Remove `posthog-js`, `@openpanel/nextjs`, `stripe`, `@stripe/stripe-js`, `public-ip` from `package.json` files and the lockfile
- [ ] T015 [US1] Full CSP per research R5 in `apps/dokploy/next.config.mjs`

## Phase 4: User Story 2 – Cannot be replaced by upstream (P1)

- [ ] T016 [US2] Delete `getUpdateData` and the update check in `packages/server/src/services/settings.ts`; restart of the `dokploy` service no longer passes `--image`
- [ ] T017 [US2] Delete `settings.getUpdateData` and `settings.updateServer` in `apps/dokploy/server/api/routers/settings.ts` and `apps/dokploy/components/layouts/update-server.tsx`, `components/dashboard/settings/web-server/update-server.tsx` and their uses in `side.tsx` and `web-server.tsx`

## Phase 5: User Story 3 – Operator supplies addresses (P2)

- [ ] T018 [US3] Delete `getPublicIpWithFallback`/`isPublicIpLookupDisabled` in `packages/server/src/wss/utils.ts`; first sign-up in `packages/server/src/lib/auth.ts` stores `SERVER_IP` or nothing
- [ ] T019 [US3] Delete the `get_ip` lookups in `packages/server/src/setup/server-setup.ts`; Swarm advertise address is `ADVERTISE_ADDR` or the server's stored `ipAddress`, and setup fails with a clear message if neither is set; same in `routers/server.ts` `getDefaultCommand`
- [ ] T020 [US3] Remove the remote `ifconfig.me`/`icanhazip.com` curl in `packages/server/src/services/domain.ts`; use the stored server address
- [ ] T021 [US3] Fix callers of removed IP helpers (`apps/dokploy/server/wss/terminal.ts`, `routers/settings.ts`, `routers/server.ts`) and update tests

## Phase 6: User Story 4 – Regressions caught (P2)

- [ ] T022 [US4] Add `scripts/check-egress.mjs` and `scripts/egress-allowlist.json` (each host with a reason) and a root `check:egress` script
- [ ] T023 [US4] Run `pnpm check:egress` in `.github/workflows/pull-request.yml`
- [ ] T024 [P] [US4] Vitest: CSP header content, no-network tests for templates (unset `TEMPLATES_URL`), and that `IS_CLOUD` is false regardless of env, in `apps/dokploy/__test__/fork/zero-egress.test.ts`; update `no-phone-home.test.ts`

## Phase 7: Polish

- [ ] T025 Document remaining destinations in `docs/fork/outbound-destinations.md` (from contracts) and env changes in `docs/fork/009-release-notes.md`
- [ ] T026 Run typecheck, server build, Biome on changed files, Vitest, `pnpm check:egress`; fix failures
- [ ] T027 Run quickstart 2 (runtime egress log) and record the result in the release notes

## Dependencies

T001 → T002 → everything else. T014 after T003–T009 and T018. T022 after all removals. T026–T027 last.
