# Research: Single Sign-On

## R1. Provider management

**Decision**: tRPC procedures call `auth.api.registerSSOProvider`, `updateSSOProvider` and
`deleteSSOProvider` server-side with the caller's headers. The plugin's HTTP routes for register,
update, delete, get, list and domain verification are added to `disabledPaths`, so every change goes
through our permission checks. `disabledPaths` only affects the HTTP router (better-auth
`api/index.mjs` `onRequest`), not `auth.api` calls.

**Why**: The plugin hydrates the OIDC config from discovery and stores it in its own format; calling
it avoids duplicating that and keeps upstream's table semantics.

## R2. Trusted origins

The plugin refuses discovered endpoints that are not trusted origins. Creating a provider adds the
issuer's origin to the organization owner's `trustedOrigins` (the existing Apache mechanism read by
`getTrustedOrigins`). Deleting a provider leaves the origin in place; owners can remove it themselves.

## R3. Domain uniqueness

The plugin does not enforce one domain per platform. Our router checks every other provider's
`domain` list on create and edit (FR-003).

## R4. Role sync

`sso({ provisionUser, provisionUserOnEveryLogin: true })`. The hook reads the groups claim from the
validated ID token payload (falls back to `userInfo[claim]`), loads `fork_sso_settings` for the
provider, and sets the member role in the provider's organization: highest mapped role
(admin > member), else default role; owners are never changed. If a mapped group is required and
none matches, the non-owner membership is removed and sign-in is refused. The existing
`user.create.after` hook already adds new SSO users to the provider's organization.

## R5. SSO-only

`webServerSettings.enforceSSO` (existing column). The `hooks.before` check blocks password, social
and passkey sign-in and email sign-up when on, except `/sign-in/email` for a user who owns an
organization. Owner break-glass sign-ins are audited. Turning it on requires a provider.

## R6. Groups claim in Authentik

Authentik's default `profile` scope emits `groups` (list of group names) in the ID token and
userinfo. Verified against 2026.8.5 discovery (`claims_supported` includes `groups`).
