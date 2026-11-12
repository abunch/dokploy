# Data Model: Zero Egress

No schema change and no migration.

- Columns used only by removed features (Stripe customer and subscription IDs, trial dates, Cloud
  server quotas) stay in place and are no longer read or written.
- `webServerSettings.serverIp` is the platform's own address. It was filled by a public-IP lookup on
  first sign-up; now it comes from `SERVER_IP` if set, otherwise it stays empty until an admin sets
  it.
- `server.ipAddress` (remote servers) is already operator-entered and is now the only source for
  remote setup and Swarm advertise address, unless `ADVERTISE_ADDR` is set.
