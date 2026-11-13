# Feature Specification: Single Sign-On

**Feature Branch**: `003-sso`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Native SSO with OIDC identity providers such as Authentik, Auth0, Okta and Keycloak: an admin screen to add providers, a sign-in-with-SSO button, automatic accounts, mapping identity-provider groups to platform roles re-checked on every sign-in, and an SSO-only mode that keeps an owner break-glass password login. OIDC first, SAML later. New SSO users default to member. SSO-only off by default. Tested end to end against a local Authentik. Written from our own requirements; no proprietary code or specs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin connects an identity provider (Priority: P1)

An owner or admin adds their company's identity provider by entering its issuer address, client
ID, client secret and the email domains it serves. The platform checks the provider is reachable
and correctly configured before saving.

**Why this priority**: Nothing else works without a configured provider.

**Independent Test**: As owner, add the local Authentik provider; the platform confirms the
connection and lists it. As a member, the screen is not available and the action is refused.

**Acceptance Scenarios**:

1. **Given** an owner, **When** they enter a valid issuer, client ID, secret and domain, **Then** the
   provider is saved and listed with its domains.
2. **Given** an unreachable or misconfigured issuer, **When** the owner saves, **Then** nothing is
   saved and the reason is shown.
3. **Given** a domain already claimed by another provider anywhere on the platform, **When** a
   provider is created or edited with it, **Then** the change is refused.
4. **Given** a member, **When** they try to view, add, edit or delete providers, **Then** they are
   refused.
5. **Given** a saved provider, **When** anyone views it, **Then** the client secret is never shown.

---

### User Story 2 - People sign in with SSO (Priority: P1)

A person enters their work email on the sign-in page, chooses "Sign in with SSO", is sent to
their identity provider, and comes back signed in. First-time users get an account automatically.

**Why this priority**: The core value of the feature.

**Independent Test**: Sign in as each Authentik test user; each lands in the organization, and a
first-time user gets an account without an invitation.

**Acceptance Scenarios**:

1. **Given** a provider for `dokploy.test`, **When** `bob@dokploy.test` chooses SSO, **Then** he is
   sent to that provider and returns signed in to the provider's organization.
2. **Given** a first-time SSO user, **When** they sign in, **Then** an account is created and they
   join the organization with the role the mapping gives them, or the provider's default role.
3. **Given** an email domain with no provider, **When** someone chooses SSO, **Then** they see that
   no provider is configured for that domain.
4. **Given** an existing password account with the same email, **When** that person signs in with
   SSO, **Then** they reach the same account, not a duplicate.
5. **Given** the provider rejects the sign-in, **When** the person returns, **Then** they see an
   error and are not signed in.

---

### User Story 3 - Roles follow identity-provider groups (Priority: P1)

An admin maps identity-provider groups to platform roles. Each SSO sign-in sets the person's role
from their current groups, so changes in the identity provider take effect at next sign-in.

**Why this priority**: Without it every SSO user needs manual role management, and leavers keep
elevated roles.

**Independent Test**: Map `dokploy-admins` to admin; Alice signs in as admin, Bob as member. Move
Alice out of the group in Authentik; at her next sign-in she is a member.

**Acceptance Scenarios**:

1. **Given** a mapping `dokploy-admins → admin`, **When** a user in that group signs in, **Then**
   their role is admin.
2. **Given** a user in several mapped groups, **When** they sign in, **Then** they get the highest
   mapped role.
3. **Given** a user in no mapped group, **When** they sign in, **Then** they get the provider's
   default role, or are refused if the provider requires a mapped group.
4. **Given** a user removed from an admin group, **When** they next sign in, **Then** their role is
   lowered.
5. **Given** the organization owner, **When** they sign in with SSO, **Then** their owner role is
   never changed by a mapping.
6. **Given** a mapping, **When** it would grant the owner role, **Then** it is refused; mappings can
   only grant admin or member.

---

### User Story 4 - SSO-only mode with a break-glass login (Priority: P2)

An owner turns on SSO-only. Everyone must then use SSO, except the owner, who can still use their
password so a broken identity provider cannot lock the organization out.

**Why this priority**: Security policy for teams that want central control, but optional.

**Independent Test**: Turn on SSO-only; Bob's password sign-in is refused with a pointer to SSO;
the owner's password sign-in still works.

**Acceptance Scenarios**:

1. **Given** SSO-only is on, **When** a non-owner signs in with a password, **Then** they are
   refused and told to use SSO.
2. **Given** SSO-only is on, **When** the owner signs in with their password, **Then** it works and
   the action is recorded in the audit log.
3. **Given** no provider is configured, **When** an owner tries to turn SSO-only on, **Then** it is
   refused.
4. **Given** SSO-only is on, **When** the sign-in page loads, **Then** SSO is the primary option
   and the password form is still reachable for the owner.

---

### Edge Cases

- Provider deleted while users signed in through it: existing sessions continue; next sign-in needs
  another method or provider.
- Provider's groups claim missing or not a list: treated as no groups.
- Email returned by the provider differs in case: matched case-insensitively.
- Provider returns no email: sign-in refused.
- Mapping references a role that does not exist: refused when saving.
- SSO user whose organization membership was removed: the next SSO sign-in adds them back with the
  mapped role (the identity provider is the source of truth for who belongs).
- Issuer reachable only from the platform's network (no internet): works, because discovery is done
  by the platform server.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Owners and admins MUST be able to create, view, edit and delete OIDC providers for
  their organization; members MUST NOT.
- **FR-002**: Creating or editing a provider MUST validate the issuer's discovery document from the
  platform server and refuse to save on failure, showing the reason.
- **FR-003**: A domain MUST belong to at most one provider across the whole platform, checked on
  both create and edit.
- **FR-004**: Client secrets MUST never be returned to the browser after saving.
- **FR-005**: The sign-in page MUST offer one-click SSO: a button per provider, labelled with its
  display name, that goes straight to the provider. With more than three providers it MUST instead
  ask for an email and route by domain. With SSO required and one provider, opening the sign-in
  page MUST go straight to the provider, except after sign-out, after an error, or with
  `?password=1`.
- **FR-006**: A first SSO sign-in MUST create the account and organization membership without an
  invitation.
- **FR-007**: An SSO sign-in for an email that already has an account MUST sign in to that account.
- **FR-008**: Each provider MUST support a list of group → role mappings (roles: admin or member),
  a groups claim name (default `groups`), a default role (default member) and a "require a mapped
  group" switch (default off).
- **FR-009**: On every SSO sign-in the person's role in the provider's organization MUST be set
  from their current groups: highest mapped role, else default role, else refused if a mapped group
  is required. The owner role MUST never be changed.
- **FR-010**: Owners MUST be able to turn SSO-only on and off; turning it on MUST require at least
  one provider.
- **FR-011**: With SSO-only on, password sign-in MUST be refused for everyone except organization
  owners.
- **FR-012**: Provider changes, mapping changes, SSO-only changes and owner password sign-ins under
  SSO-only MUST be written to the audit log.
- **FR-013**: The feature MUST make no outbound call except to the configured provider.
- **FR-014**: Upgrading MUST keep existing data; database changes are additive only.
- **FR-015**: Tests MUST cover the refused paths, and SSO MUST be tested end to end against a real
  identity provider (local Authentik).

### Key Entities

- **SSO provider**: issuer, client credentials, domains, organization (existing upstream table).
- **SSO settings** (new, per provider): groups claim name, group → role mappings, default role,
  require-mapped-group switch.
- **Organization SSO-only flag**: existing platform setting, now honoured.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin connects a new OIDC provider in under 5 minutes using only the issuer, client
  ID, secret and domain.
- **SC-002**: A first-time user signs in with SSO in one round trip, with no invitation.
- **SC-003**: A group change in the identity provider is reflected in the person's role at their
  next sign-in, 100% of the time.
- **SC-004**: With SSO-only on, 0 non-owner password sign-ins succeed and the owner's break-glass
  sign-in always works.
- **SC-005**: All refused paths in the stories are covered by automated tests, and the end-to-end
  run against Authentik passes.

## Assumptions

- OIDC only in this feature; SAML and SCIM are later work.
- One platform-wide sign-in page; SSO for deployed applications (forward auth) is a later feature.
- Group-based roles cover owner/admin/member; custom roles come with the custom-roles feature.
- Domain ownership is trusted from the admin's input; DNS domain verification is a later option.
- Written from our own requirements; no proprietary code or specifications were used.
