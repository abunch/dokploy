# Feature Specification: Remove Proprietary Code and Phone-Home

**Feature Branch**: `001-remove-proprietary`

**Created**: 2026-11-09

**Status**: Draft

**Input**: User description: "Remove the DSAL-licensed proprietary code and all vendor phone-home from the Dokploy fork. Delete every `proprietary/` directory without reading their contents. Core files that import them must keep compiling and working; remove the license-key validation cron, the enterprise license gating and the UI entry points that only existed for proprietary features. SSO, audit log viewing and custom roles are temporarily unavailable until later features rebuild them; existing audit writes and the built-in owner/admin/member roles keep working. No outbound call to any Dokploy-controlled endpoint remains in self-hosted mode; update checks and template catalog fetches become operator-configurable and can be disabled. Existing installs upgrade without data loss; tables used only by removed features are left in place. Typecheck, lint and the test suite pass."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the platform with no proprietary code (Priority: P1)

An operator installs or upgrades the fork and runs it in production without any commercial license
agreement. The shipped product contains no file from upstream's proprietary folders, and every
core capability (projects, applications, compose stacks, databases, domains, certificates, backups,
remote servers, Swarm clusters, notifications, the built-in owner/admin/member roles) works as it
did before.

**Why this priority**: This is the reason the fork exists. Every later feature builds on a
codebase that is free of DSAL-licensed code.

**Independent Test**: Build the product, confirm no `proprietary/` path exists anywhere in the
source or build output, then sign in as owner, create a project, deploy an application with a
domain and HTTPS, invite a member and confirm the member's access matches the built-in role.

**Acceptance Scenarios**:

1. **Given** the fork's source tree, **When** it is searched for `proprietary/` paths or imports,
   **Then** none are found.
2. **Given** a fresh install, **When** the owner creates a project and deploys an application with
   a domain, **Then** the deployment, routing and certificate behave as on upstream.
3. **Given** a member and an admin in an organization, **When** each performs actions allowed and
   denied by their built-in role, **Then** allowed actions succeed and denied actions are refused.
4. **Given** an organization that never had a license, **When** an admin opens any settings page,
   **Then** no page asks for a license key or shows an "enterprise feature" lock.

---

### User Story 2 - Run in an isolated network without phone-home (Priority: P1)

An operator runs the platform in a VPC whose egress only allows their own registries, git hosts
and identity providers. The platform never contacts a Dokploy-controlled endpoint and nothing
breaks or degrades because such endpoints are unreachable.

**Why this priority**: Unsanctioned egress is a deployment blocker in the target environments.

**Independent Test**: Run the platform for 7 days (or with all scheduled jobs forced to run) with
all outbound traffic logged and Dokploy-controlled domains blocked; confirm zero attempts to reach
them and no feature failures.

**Acceptance Scenarios**:

1. **Given** default settings in self-hosted mode, **When** the platform runs and all scheduled
   jobs execute, **Then** no request is made to a license server, analytics, telemetry or
   marketing endpoint.
2. **Given** the update check is disabled by the operator, **When** an admin opens the dashboard,
   **Then** no request is made to check for new versions and no error is shown.
3. **Given** the template catalog is disabled or pointed at an operator-hosted URL, **When** an
   admin opens the templates view, **Then** no request reaches the default upstream catalog.
4. **Given** the operator has entered the server's public address, **When** servers are set up or
   settings are saved, **Then** no third-party IP lookup service is contacted.

---

### User Story 3 - Upgrade an existing install without loss (Priority: P2)

An operator running upstream Dokploy, possibly with enterprise features configured, upgrades to
the fork. All projects, services, domains, users and history survive. Settings that belonged to
removed features stay in the database untouched so a later feature can reuse them.

**Why this priority**: Operators must be able to move to the fork safely.

**Independent Test**: Restore a database from the latest upstream release with SSO providers,
custom roles, audit entries and whitelabeling configured; upgrade; confirm every core record is
present and the removed-feature records still exist unchanged.

**Acceptance Scenarios**:

1. **Given** an upstream database, **When** the fork starts and runs its migrations, **Then** no
   table or column is dropped and no core record is lost.
2. **Given** an application domain that was protected by SSO forward-auth, **When** the fork is
   running, **Then** the domain does not become publicly reachable without authentication.
3. **Given** a user who was assigned a custom role, **When** they sign in after the upgrade,
   **Then** they receive no more access than the built-in member role grants.

---

### User Story 4 - Keep recording the audit trail (Priority: P3)

Actions that upstream's open code records to the audit trail (sign-ins, deployments, settings
changes) continue to be recorded, so there is no gap in history when the audit log viewer is
rebuilt in a later feature.

**Why this priority**: The viewer can wait; lost history cannot be recovered.

**Independent Test**: Perform a sign-in, a deployment and a settings change, then confirm three
matching entries exist in the audit store with actor, action, target and time.

**Acceptance Scenarios**:

1. **Given** the fork is running, **When** a user signs in and deploys an application, **Then**
   each action produces an audit entry with who, what, which resource and when.
2. **Given** recording an audit entry fails, **When** the triggering action runs, **Then** the
   action still completes and the failure is logged.

### Edge Cases

- A domain had SSO forward-auth enabled: requests must be refused rather than passed through
  unauthenticated, and the admin can see why and disable the protection.
- A user's only sign-in method was SSO or GitHub/Google social login: the owner can still reach
  them by resetting their password or re-inviting them; the owner account always has a password
  sign-in path.
- The organization's default role for new members was a custom role: new members get the built-in
  member role instead.
- Whitelabeling was configured: the product shows its default branding; stored whitelabel settings
  are kept but ignored.
- Bookmarked URLs for removed settings pages (license, SSO, audit logs, whitelabeling) return a
  normal "not found" page, not a crash.
- Cloud mode (`IS_CLOUD`) is out of scope and must not be relied on; self-hosted behaviour is what
  is tested.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The source tree and build output MUST contain no file from any upstream
  `proprietary/` folder and no import of such a file.
- **FR-002**: No upstream proprietary file MUST be opened or read during this work; replacement
  code is written only from this spec and from Apache-2.0 code.
- **FR-003**: Every capability gated on a vendor license MUST either be available without a license
  (when its code is Apache-2.0) or be removed from the product (when its code was proprietary).
- **FR-004**: The scheduled license validation job and any other contact with a license server
  MUST be removed.
- **FR-005**: Settings pages, menu entries and sign-in buttons that existed only for removed
  features (license key, SSO, SCIM, forward-auth servers, audit log viewer, custom roles,
  whitelabeling, GitHub/Google social sign-in, sign-up showcase) MUST be removed from the UI and
  navigation.
- **FR-006**: The built-in owner, admin and member roles and their existing per-resource
  permissions MUST behave as on upstream, including denials.
- **FR-007**: Users assigned a custom role MUST be treated as built-in members with no additional
  grants until custom roles are rebuilt.
- **FR-008**: Domains with SSO forward-auth enabled MUST fail closed (deny access) and the admin
  MUST be able to turn the protection off per domain.
- **FR-009**: Actions that the open code records to the audit trail MUST continue to be written to
  the existing audit store; a write failure MUST NOT fail the action.
- **FR-010**: In self-hosted mode the product MUST NOT contact any Dokploy-controlled endpoint for
  licensing, analytics, telemetry or marketing.
- **FR-011**: The version update check MUST be operator-configurable and MUST be possible to
  disable entirely.
- **FR-012**: The template catalog source MUST be operator-configurable (custom URL or disabled).
- **FR-013**: Public IP auto-detection via third-party lookup services MUST be skippable when the
  operator supplies the address, and MUST be possible to disable.
- **FR-014**: Database migrations in this feature MUST NOT drop or rewrite tables or columns used by
  removed features.
- **FR-015**: Typecheck, lint and the full test suite MUST pass; tests that covered removed
  features are removed and tests for the built-in roles are kept, including denial paths.

### Key Entities

- **License state**: per-owner flags and key that upstream used to enable enterprise features;
  left in storage, no longer read.
- **SSO provider / forward-auth server / SCIM / custom role / whitelabel settings**: records of
  removed features; preserved untouched for later features to adopt or migrate.
- **Audit entry**: who did what to which resource and when; still written, viewer rebuilt later.
- **Outbound endpoint settings**: operator choices for update checks, template catalog and IP
  detection.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A search of the source and build output finds 0 files or imports from proprietary
  folders.
- **SC-002**: With Dokploy-controlled domains blocked and egress logged, 0 attempts to reach them
  occur across a full cycle of scheduled jobs and a scripted walk through every dashboard page.
- **SC-003**: Upgrading from the latest upstream database loses 0 core records and drops 0 tables.
- **SC-004**: 100% of remaining automated tests pass, including built-in role denial tests.
- **SC-005**: An operator completes install → first deployment with HTTPS without encountering any
  license prompt or locked feature.

## Assumptions

- Upstream `canary` as of the branch point is the baseline; later upstream changes to proprietary
  folders are discarded during syncs.
- SSO, SCIM, forward-auth, custom roles, audit log viewing, whitelabeling and social sign-in are
  rebuilt (or dropped) in later features; their absence is acceptable for this release.
- The audit store's schema is Apache-2.0 and may be written to by fork-owned code.
- Cloud-only paths gated by `IS_CLOUD` (billing, server limits, cloud analytics) stay as upstream
  wrote them, since self-hosted operators never enable them; any vendor endpoint they reference
  must not be reachable from self-hosted mode.
- Update-check and template-catalog defaults stay as upstream for compatibility, with a documented
  setting to disable them for isolated networks.
