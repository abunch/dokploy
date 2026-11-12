# Instrumentation Inventory

Everything in the platform that records, measures or reports activity: what it is, what it is for,
where the data goes, and how to turn it off. Nothing here sends data to the vendor or any third party
unless the operator configures a destination.

## Removed (009)

| What | What it did |
|---|---|
| PostHog (server and browser) | Product analytics, session replay, sign-up and deploy events, with a built-in vendor key |
| HubSpot | Sign-up form submission, contact deletion, chat widget |
| Google Tag Manager, OpenPanel | Marketing and page analytics |
| Chatwoot widget | Third-party chat |
| Gravatar | Avatar lookup by hashed email |
| Update check | Polled Docker Hub for new vendor images |
| Public-IP lookups | Asked ifconfig.io, ifconfig.me, icanhazip.com, ipecho.net for the server's address |
| Next.js build telemetry | Build statistics to Vercel (`NEXT_TELEMETRY_DISABLED=1`) |

## Pinned off

| What | Default upstream | Now |
|---|---|---|
| Traefik version check (`checkNewVersion`) | On: contacts the Traefik update service | Off in new configs; existing configs are rewritten on startup (local) and on server setup (remote), backup kept. Applies when Traefik next restarts |
| Traefik anonymous usage report (`sendAnonymousUsage`) | Off | Off, pinned |
| better-auth telemetry | Off unless `BETTER_AUTH_TELEMETRY` and `BETTER_AUTH_TELEMETRY_ENDPOINT` are set | Off in code; env vars cannot enable it |

## Kept: stays on your infrastructure

| What | Purpose | Where the data lives | Turn off |
|---|---|---|---|
| Application log (pino) | Platform errors and events | stdout of the platform container | n/a (Docker log driver decides retention) |
| Deployment logs | Build and deploy output per deployment | Files under `/etc/dokploy/logs` | Deleted with the deployment |
| Audit log | Who did what (sign-in, create, delete, deploy) | `audit_log` table | Viewer returns in feature 004 |
| Sessions | Active sign-ins with IP address and browser user agent | `session` table | Revoke in Settings → Sessions |
| Traefik access log | The "Requests" page: per-request host, path, status, timing | Access log file on each server | Turn off on the Requests page |
| Container stats ("free" monitoring) | Live CPU, memory, network per container in the UI | Read on demand from Docker, not stored | Not opened = not collected |
| Monitoring agent (`dokploy/monitoring`) | Server and container metrics history and threshold alerts | SQLite on each server, retention set in the UI; alerts post back to this platform | Leave server monitoring disabled |

## Kept: leaves only to destinations you configure

| What | Purpose | Sends to | Off when |
|---|---|---|---|
| Vector and cAdvisor agents | Ship container logs and metrics | Only the log and metrics providers you add (Loki, Datadog, Elasticsearch, InfluxDB, Splunk, Prometheus, Better Stack, New Relic) | No provider configured: the agents are removed |
| Notifications | Deploy, backup, threshold and restart alerts | Only the channels you add | No channel configured |
| AI features | Compose generation and log analysis | Only the AI endpoint you configure; log analysis sends the log text you submit | No AI provider configured |
| Backups | Database and volume backups | Only the S3 destinations you add | No destination configured |

## Third-party components

| Component | Telemetry |
|---|---|
| Traefik | Version check and usage report pinned off (above) |
| PostgreSQL, Redis | None |
| Docker Engine | None (Docker Desktop's telemetry does not apply to servers) |
| Vector, cAdvisor, rclone | None by default; only send to configured outputs |
| Nixpacks, Railpack, Cloud Native Buildpacks | Builders run on your servers; not audited for telemetry yet. Block their egress at the network if required |

## Verifying

- `pnpm check:egress` (CI) lists every external host in shipped code with a reason.
- The browser Content-Security-Policy blocks any request to another origin.
- Run with network egress restricted to the destinations in `outbound-destinations.md`; anything
  else shows up as a blocked connection.
