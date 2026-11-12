# Contract: Environment Variables

| Variable | Default | Effect |
|---|---|---|
| `DISABLE_UPDATE_CHECK` | unset | `true`: the dashboard reports no update and never contacts Docker Hub |
| `TEMPLATES_URL` | `https://templates.dokploy.com` | Base URL of the template catalog; empty string disables the catalog and the templates view says so |
| `DISABLE_PUBLIC_IP_LOOKUP` | unset | `true`: never call public-IP services; use the configured server IP or the first global interface address |

Isolated-network profile: set all three (`TEMPLATES_URL=` empty or an internal mirror).
