# Research: Remove Proprietary Code and Phone-Home

Method: only file names under `proprietary/` and the import and call lines in Apache files were
inspected. No proprietary file was opened.

## R1. What open code needs from the proprietary modules

| Function used by open code | Call sites | Replacement |
|---|---|---|
| `hasValidLicense(orgId)` | `trpc.ts`, `permission.ts`, `services/server.ts`, `services/git-provider.ts`, routers `organization`, `user`, `server`, `git-provider` | Removed. Every branch takes the licensed path. |
| `createAuditLog(entry)` | `api/utils/audit.ts`, `lib/auth.ts` (login, logout) | `writeAuditLog` in `services/fork/org.ts`: insert into the Apache `audit_log` table; errors are caught and logged |
| `resolveOrganizationDefaultRole(orgId)` | `lib/auth.ts` (SCIM and SSO user creation) | `getOrganizationDefaultRole`: the organization's stored default role if it is built-in or an existing custom role, else `member` |
| `getOrganizationOwnerId(orgId)` | `server/utils/billing.ts` (cloud only) | `getOrganizationOwnerId` reading `organization.ownerId` |
| Routers (license, sso, scim, forward-auth, custom-role, audit-log, whitelabeling) | `root.ts` and the UI calls listed in contracts/api-removed.md | Removed; UI callers edited |

Decision: implement the four helpers from the Apache schema and call sites alone.
Rationale: each is a single query whose behaviour is implied by its name and callers.
Alternatives: porting Milpia/Crane equivalents (deferred to 003/004 with provenance checks).

## R2. Open-code capabilities that were license-gated

- Custom-role enforcement (`permission.ts` `resolveRole`) reads `organization_role` rows: kept,
  now always on. Editing roles was proprietary UI and is gone until the custom-roles feature.
- Per-member server and git-provider access (`services/server.ts`, `services/git-provider.ts`,
  `user.assignPermissions`, `allForPermissions` routes): always on.
  Behaviour change: on an unlicensed upstream install, members saw every server; after the upgrade
  they see only assigned servers. Documented in release notes; admins assign via the existing
  permissions dialog, whose lock is removed.
- `enterpriseOnlyResources` (`access-control.ts`): unchanged; owners and admins keep full access to
  these resources, members get them only through custom roles or legacy overrides.
- `remoteServersOnly` setting: route moves from `enterpriseProcedure` to owner/admin only.
- Forward-auth: middleware generation (`utils/traefik/forward-auth.ts`) and the proxy setup are
  open code and keep working. The enable/disable/status router was proprietary; the domain dialog
  switches to the open domain update route to turn `forwardAuthEnabled` off.

Decision: keep `enterpriseProcedure` as an owner/admin-only procedure under a new name
(`ownerOrAdminProcedure`) if no existing procedure matches; otherwise reuse `adminProcedure`.

## R3. SSO and SCIM

better-auth's `sso` and `scim` plugins are MIT and configured in Apache `auth.ts`. Their sign-in
endpoints keep working for providers already stored, but the button that starts SSO sign-in and
the provider management screens were proprietary.

Decision: keep both plugins registered (no schema churn, 003 decides their fate); ignore
`enforceSSO` in the auth hook and hide its toggle, so password sign-in always works (FR-017).
SCIM token generation stays gated on `enableEnterpriseFeatures`, which nothing can now set, so
SCIM is effectively off until 003.

## R4. Social sign-in (GitHub/Google)

Only the buttons were proprietary. better-auth social providers are configured from
`getTrustedProviders`. Decision: remove the buttons; leave server config untouched.

## R5. Outbound endpoints

| Endpoint | Where | Decision |
|---|---|---|
| licenses-api.dokploy.com | `utils/crons/enterprise.ts` | Delete file and its startup call and export |
| PostHog, OpenPanel, GTM, HubSpot | `analytics.tsx`, `tracking/*`, `auth.ts` | Already behind `IS_CLOUD`; unchanged (thin delta). A test asserts nothing renders or fires when `IS_CLOUD` is unset |
| hub.docker.com tags | `services/settings.ts` `getUpdateData` | `DISABLE_UPDATE_CHECK=true` returns "no update" without a request |
| templates.dokploy.com | `templates/github.ts`, template UI | `TEMPLATES_URL` env sets the default base URL; empty string disables the catalog |
| public-ip lib, ifconfig.io/me, icanhazip, ipecho | `wss/utils.ts`, `server-setup.ts`, `services/domain.ts` | `DISABLE_PUBLIC_IP_LOOKUP=true` skips them; the stored server IP or the interface address is used |
| docs.dokploy.com, dokploy.com links, email templates | UI and emails | Links only, not calls; rebrand in 007 |

Decision: environment variables, not new settings columns. Rationale: no migration, works before
first sign-in, fits isolated-network installs. A UI can come later.

## R6. Tests

Tests under `__test__/permissions` and `__test__/git-provider` mock
`services/proprietary/license-key`. They are updated to drop the mock and assert the licensed
behaviour, keeping all denial cases. `enterprise-only-resources.test.ts` is kept as is.
