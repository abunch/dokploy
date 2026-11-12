# Release Notes: Proprietary Code Removed

## Removed

- License key page, enterprise badges and every "enterprise feature" lock.
- SSO, SCIM and forward-auth server settings, the SSO sign-in button, GitHub/Google sign-in
  buttons and the cloud sign-up showcase. SSO returns in feature 003.
- Audit log viewer and export. Audit entries are still recorded; the viewer returns in 004.
- Custom role editor. Roles already defined keep working and can no longer be edited.
- Whitelabeling. Stored settings are kept and ignored; default branding is shown.
- The license validation job that contacted `licenses-api.dokploy.com` every three days.

## Now available to every organization

- Per-member server and git provider assignment.
- "Remote servers only" (owner/admin).
- Enforcement of existing custom roles, and a custom role as the default for new members.

## Behaviour changes on upgrade

- **Members only see servers assigned to them.** On an unlicensed upstream install members saw
  every server. After upgrading, assign servers to members under Settings → Users → Permissions.
- **"Enforce SSO" is ignored** so password sign-in keeps working while SSO is unavailable.
- **Domains with SSO forward-auth stay protected.** They can be unprotected from the shield
  button on the domain, but not re-protected until SSO returns.

## Isolated networks

| Variable | Effect |
|---|---|
| `DISABLE_UPDATE_CHECK=true` | No Docker Hub tag lookup |
| `TEMPLATES_URL=` (empty) or `TEMPLATES_URL=https://mirror.internal` | Disable or mirror the template catalog |
| `DISABLE_PUBLIC_IP_LOOKUP=true` | No public-IP services; remote servers advertise their configured address |

`ADVERTISE_ADDR` is now honoured by remote server setup.

No database tables or columns were changed.
