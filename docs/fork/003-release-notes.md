# 003 Single Sign-On: Release Notes

Sign in with any OpenID Connect identity provider (Authentik, Auth0, Okta, Keycloak, Entra ID)
without a license. Built from our own spec on better-auth's MIT `sso` plugin; no proprietary code
or specifications were used.

## What's new

- **Settings → Single sign-on** (owners only): add, edit and delete providers with an
  issuer URL, client ID, client secret and email domains. The platform validates the issuer's
  discovery document before saving and shows the redirect URI to register. Secrets are never sent
  back to the browser.
- **One-click sign-in**: the sign-in page shows a "Sign in with <name>" button per provider (name
  set as the provider's button label) that goes straight to the identity provider; no email first.
  With more than three providers it asks for an email and routes by domain instead. First-time
  users get an account automatically.
- **Auto-redirect**: with SSO required and a single provider, opening the platform goes straight to
  the identity provider. It is skipped after signing out (otherwise the provider would sign you
  straight back in), after a sign-in error, and on `/?password=1`, where owners reach the
  password form. Provider button labels are visible to anyone who opens the sign-in page.
- **Group → role mapping**: map identity-provider groups to admin or member. Roles are re-applied
  at every SSO sign-in, so changes in the identity provider take effect at the next sign-in. The
  highest matching role wins; owners are never changed. Optional "require a mapped group" refuses
  sign-in and removes access for people in none of the groups.
- **Switching providers without downtime**: each provider is Active or Inactive. A new provider
  whose domains overlap an active one is added inactive, so you can set it up first; "Make active"
  turns it on and the overlapping provider off in one step. Inactive providers get no button and
  refuse sign-ins. People keep their Dokploy accounts across a switch (matched by email).
- **Any groups claim shape**: a list of names (Authentik, Keycloak, Okta, Entra) or an object keyed
  by role name (Zitadel's `urn:zitadel:iam:org:project:roles`). Auth0 needs an Action that adds a
  custom roles claim; set its name as the provider's groups claim.
- **Require SSO** (owner only, needs a provider): password, passkey and social sign-in and
  self-sign-up are refused for everyone except organization owners, who keep password sign-in as a
  break-glass. Owner break-glass attempts are audited.
- Provider, mapping and SSO-only changes are written to the audit log.

## Security notes

- Only organization owners manage providers. A provider decides who can sign in as which account,
  so an admin adding one could otherwise sign in as the owner.
- An SSO sign-in links to an existing account only if that person is a member of the provider's
  organization or of none yet, so one organization's provider cannot take over another's users.
- Existing password users can move to SSO: linking does not require the local email to have been
  verified, because accounts only come from invitations and only owners declare provider domains.

- Another organization's provider domains (including subdomains: `example.com` covers
  `eu.example.com`) can never be claimed. Within an organization, overlapping providers are allowed
  only while at most one of them is active.
- Provider management is only available through the permission-checked API; the plugin's own HTTP
  routes for registering, editing, listing and deleting providers are closed.
- Adding a provider adds its issuer origin to the owner's trusted origins, which the plugin
  requires for discovery.
- API keys keep working while SSO is required (automation).

## Operator changes

- Two additive migrations: `0199` creates `fork_sso_settings`; `0200` adds `display_name` and
  `enabled`.
- `settings.updateEnforceSSO` is replaced by `forkSso.setSsoOnly` (owner only, needs a provider).

## Local identity provider

`dev/zitadel/` runs Zitadel v4.20.3 (telemetry off) with `setup.mjs` to create a project, roles,
an OIDC app and users; `ZITADEL_SWAP=1 scripts/sso-e2e.mjs` stages Zitadel next to Authentik,
switches, signs in through Zitadel and switches back.

`dev/authentik/` runs Authentik 2026.8.5 with update checks, error reporting and analytics off, plus
a Dokploy OIDC app and test users alice (admins), bob (developers) and carol (no group).
`scripts/sso-e2e.mjs` signs each in through Authentik and checks roles, a role downgrade after
leaving a group, the required-group refusal and SSO-only mode.

## Not in this feature

SAML, SCIM provisioning, SSO for deployed applications (forward auth), custom roles from groups,
DNS domain verification.
