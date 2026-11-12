# Outbound Destinations

Anything not listed here is a defect.

## Operator-configured (only when the operator sets them up)

| Destination | Configured where |
|---|---|
| Git hosts (GitHub, GitLab, Gitea, Bitbucket, any git URL) | Git providers, application source |
| Container registries | Registries, application image |
| Notification targets (Slack, Discord, Telegram, email/SMTP, Resend, Gotify, ntfy, Pushover, Lark, Teams, Mattermost, webhooks) | Notifications |
| S3-compatible storage | Destinations (backups) |
| AI endpoints | Settings → AI |
| DNS providers (Cloudflare, Route 53, others) | DNS settings |
| Secret stores (Vault, Infisical, Phase, Azure Key Vault) | Secret providers |
| Certificate authority (Let's Encrypt or custom ACME) | Web server / domain HTTPS |
| Template catalog | `TEMPLATES_URL` (off when unset) |
| Monitoring endpoints | Server monitoring (operator's own servers) |

## Operator action: remote-server setup

Run on the remote server, only when the operator clicks "Setup server":

| Download | Purpose |
|---|---|
| `get.docker.com` | Install Docker if missing |
| `github.com/docker/compose` releases | Install Compose plugin if missing |
| `nixpacks.com/install.sh`, `railpack.com/install.sh` | Build tools |
| `rclone.org/install.sh` | Backup tool |
| Docker Hub images (Traefik, Postgres, monitoring) | Platform components |

Avoid these by using pre-built server images; the egress firewall can then block them.

## Never

Analytics, tracking, CRM, tag managers, session replay, avatar services, billing providers, the
vendor's update, license, template or job services, public-IP lookup services, CDNs for browser code.

## Enforcement

- `pnpm check:egress` (run in CI) fails on any external host in shipped code that is not in
  `scripts/egress-allowlist.json`. Each allowlisted host has a reason: operator integration,
  installer, link, comment, example or standard identifier. Hosts built at runtime from operator
  input are not visible to this check.
- Browsers receive a Content-Security-Policy that allows only the platform's own origin (plus the
  operator's template catalog for images).
- Code removal is not a substitute for network policy: run the platform in a network whose egress
  only allows the destinations above.
