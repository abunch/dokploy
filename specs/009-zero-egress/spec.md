# Feature Specification: Zero Egress

**Feature Branch**: `009-zero-egress`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Remove every outbound network call that the operator did not explicitly configure. Delete (not gate) all analytics and tracking, the hosted-service (Cloud) code that talks to vendor services, the update check and in-app self-update, the default template catalog, public IP lookups and remote images in emails. Keep operator-configured destinations and the remote-server setup installers, and document them. Add a strict browser content policy and a CI check that fails when a new external host appears outside an allowlist. Existing installs upgrade without data loss."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The platform contacts nobody it was not told to (Priority: P1)

A security-conscious operator runs the platform and needs certainty that it never contacts a
third party on its own: no analytics, tracking, marketing, billing, update or "what is my IP"
services. The only outbound traffic is to destinations the operator configured (their git hosts,
registries, notification targets, storage, AI endpoints, identity provider, certificate
authority) or caused by an explicit operator action such as setting up a server.

**Why this priority**: The operator will not deploy a platform that phones home. This is a
precondition for running in a locked-down network.

**Independent Test**: Run the platform with outbound traffic logged, use every main screen as
owner (sign up, sign in, projects, deploy an application, settings, profile, users, templates,
notifications), and confirm the log contains no destination the operator did not configure.

**Acceptance Scenarios**:

1. **Given** a running platform with no integrations configured, **When** an owner uses every main
   screen for 10 minutes, **Then** the server makes zero outbound connections.
2. **Given** the same session, **When** the browser's network activity is inspected, **Then** every
   request goes to the platform's own address.
3. **Given** the shipped source and build output, **When** they are searched for analytics,
   tracking, billing or IP-lookup services, **Then** none are found.
4. **Given** any environment variable setting, **When** the platform starts, **Then** hosted-service
   (Cloud) behaviour cannot be switched on.

---

### User Story 2 - The fork cannot be silently replaced by upstream (Priority: P1)

An operator must never have the platform pull the upstream vendor's image over itself, which
would bring back the removed proprietary code and phone-home behaviour.

**Why this priority**: One click on an update button would undo every guarantee of this fork.

**Independent Test**: Search the product and screens for any update check or self-update action
that targets the upstream vendor's image; none exist. Upgrading is done by the operator deploying
a new image.

**Acceptance Scenarios**:

1. **Given** a running platform, **When** an admin opens every settings screen, **Then** no screen
   offers to check for or install updates from the upstream vendor.
2. **Given** a running platform, **When** it runs for 24 hours, **Then** it makes no request to any
   image registry to look for new versions of itself.

---

### User Story 3 - The operator supplies addresses instead of looking them up (Priority: P2)

Server setup and domain checks used to ask public "what is my IP" services. Now the operator
provides the server's IP address and the cluster advertise address.

**Why this priority**: Needed to run in an isolated network, and removes a third-party lookup.

**Independent Test**: Set up a remote server and add a domain with a known IP and no internet
access beyond the server itself; setup and domain checks use the supplied address.

**Acceptance Scenarios**:

1. **Given** a remote server with an IP address entered by the operator, **When** the operator runs
   server setup, **Then** the cluster uses that address and no public lookup is made.
2. **Given** the first owner signs up, **When** the platform records its own address, **Then** it
   uses the address the operator configured, or leaves it blank for the operator to fill in.
3. **Given** a domain check, **When** the platform compares DNS to the server address, **Then** it
   uses the stored server address and never asks an outside service.

---

### User Story 4 - Regressions are caught automatically (Priority: P2)

A maintainer merging upstream changes or new code needs to know immediately if a new external
destination appears.

**Why this priority**: Upstream syncs happen weekly; without a gate, tracking could return
unnoticed.

**Independent Test**: Open a pull request that adds a reference to a new external host in shipped
code; the check fails and names the host and file. Remove it; the check passes.

**Acceptance Scenarios**:

1. **Given** a change that adds a new external host to shipped code, **When** CI runs, **Then** the
   check fails and lists the host and file.
2. **Given** a host that is on the reviewed allowlist (for example documentation links or
   operator-chosen installer sources), **When** CI runs, **Then** the check passes.

---

### Edge Cases

- Existing installs that stored billing, tracking or Cloud-only data: the data stays in place and is
  ignored; nothing is deleted.
- An install previously started with the hosted-service flag on: it starts in self-hosted mode.
- No server IP configured: screens that need it show an empty value and ask the operator to enter
  it, rather than looking it up.
- Templates with no catalog configured: the template screen states that no catalog is configured.
- Users whose avatar pointed at an external avatar service: they see a built-in avatar.
- Documentation links in the UI remain clickable; following a link is the user's own action, not
  the platform contacting anyone.
- Notification emails already sent keep their old images; new emails carry no remote images.
- Fonts used by the UI are bundled at build time and never fetched at runtime.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST NOT contain analytics, tracking or marketing integrations, in server
  or browser code, including product analytics, marketing CRM forms, tag managers and session
  replay.
- **FR-002**: The product MUST NOT load or display avatars from an external avatar service.
- **FR-003**: The product MUST NOT contain billing integrations or billing screens.
- **FR-004**: The product MUST NOT contain the hosted-service (Cloud) job services or the code that
  sends deployments and backups to them; deployments and backups always run on the platform or
  the operator's servers.
- **FR-005**: Hosted-service (Cloud) mode MUST be permanently off; no configuration can turn it on.
- **FR-006**: The product MUST NOT check any registry or vendor service for new versions of itself,
  and MUST NOT offer an in-app action that replaces the running platform with another image.
- **FR-007**: The template catalog MUST be off unless the operator sets a catalog address; there is
  no built-in default address.
- **FR-008**: The product MUST NOT query public IP lookup services. Server setup and domain checks
  use the address the operator supplied; the cluster advertise address can be set by the operator.
- **FR-009**: Emails the platform sends MUST NOT reference images or other resources on remote
  hosts.
- **FR-010**: Log and console messages MUST NOT instruct operators to download and run scripts from
  the vendor's website.
- **FR-011**: The build MUST NOT send build telemetry to any service.
- **FR-012**: Browsers MUST be instructed (by a content policy sent with every page) to load
  scripts, styles, fonts, images and data only from the platform's own address, except for
  explicitly listed operator-configured destinations.
- **FR-013**: CI MUST fail when shipped code references an external host that is not on a reviewed
  allowlist, naming the host and file.
- **FR-014**: The remaining outbound destinations MUST be documented: each operator-configured
  integration, and each installer that remote-server setup downloads, with when it runs.
- **FR-015**: Upgrading an existing install MUST NOT delete or alter stored data; no destructive
  migration.
- **FR-016**: Typecheck, the server build, lint and the test suite MUST pass.

### Key Entities

- **Outbound destination**: a host the platform or browser contacts. Classified as
  operator-configured, operator-action (server setup installers), or forbidden.
- **Allowlist**: the reviewed list of external hosts permitted to appear in shipped code, each with
  a reason.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a 10-minute session covering every main screen with no integrations configured,
  the server makes 0 outbound connections and the browser makes 0 requests to other addresses.
- **SC-002**: 0 analytics, tracking, billing or IP-lookup services remain in the shipped source,
  dependencies or build output.
- **SC-003**: A pull request that adds an unlisted external host fails CI 100% of the time.
- **SC-004**: An install upgraded from the previous fork release keeps 100% of its projects,
  applications, domains, users and settings.
- **SC-005**: The platform runs and deploys applications in a network whose only allowed egress is
  to operator-configured destinations.

## Assumptions

- Operator-configured integrations (git providers, registries, notification targets, S3, AI
  endpoints, identity provider, certificate authority) are intended traffic and stay.
- Remote-server setup installers (container runtime, compose, build tools, backup tool) stay because
  they run only when the operator sets up a server; they are documented and can be avoided by
  using pre-built server images. Replacing them with an operator mirror is out of scope.
- Image pulls for the platform's own components and the operator's apps go through the container
  runtime to registries the operator chose; publishing the fork's own image is roadmap item 007.
- Upgrades are done by the operator deploying a new image; an in-app updater for the fork's own
  registry may return in item 007.
- Documentation links stay as plain links.
- Data left by removed features stays in the database untouched.
