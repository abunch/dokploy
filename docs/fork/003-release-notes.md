# 003 Single Sign-On: Release Notes

Sign in with any OpenID Connect identity provider (Authentik, Auth0, Okta, Keycloak, Entra ID)
without a license. Built from our own spec on better-auth's MIT `sso` plugin; no proprietary code
or specifications were used.

## What's new

- **Settings → Single sign-on** (owners and admins): add, edit and delete providers with an
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
- **Require SSO** (owner only, needs a provider): password, passkey and social sign-in and
  self-sign-up are refused for everyone except organization owners, who keep password sign-in as a
  break-glass. Owner break-glass attempts are audited.
- Provider, mapping and SSO-only changes are written to the audit log.

## Security notes

- A domain can belong to only one provider on the platform, including subdomains
  (`example.com` blocks `eu.example.com` on another provider), checked on create and edit.
- Provider management is only available through the permission-checked API; the plugin's own HTTP
  routes for registering, editing, listing and deleting providers are closed.
- Adding a provider adds its issuer origin to the owner's trusted origins, which the plugin
  requires for discovery.
- API keys keep working while SSO is required (automation).

## Operator changes

- One additive migration: `fork_sso_settings`.
- `settings.updateEnforceSSO` is replaced by `forkSso.setSsoOnly` (owner only, needs a provider).

## Local identity provider

`dev/authentik/` runs Authentik 2026.8.5 with update checks, error reporting and analytics off, plus
a Dokploy OIDC app and test users alice (admins), bob (developers) and carol (no group).
`scripts/sso-e2e.mjs` signs each in through Authentik and checks roles, a role downgrade after
leaving a group, the required-group refusal and SSO-only mode.

## Not in this feature

SAML, SCIM provisioning, SSO for deployed applications (forward auth), custom roles from groups,
DNS domain verification.
