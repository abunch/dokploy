# 009b Supply Chain: Release Notes

Audit of everything the vendor publishes that the fork pulled in.

## Changed

- **Scarf install analytics off.** `@scarf/scarf` (a Swagger UI dependency) reports installs to
  scarf.sh from its install script. The script is no longer allowed to run, and
  `scarfSettings.enabled=false`, `SCARF_ANALYTICS=false` and `DO_NOT_TRACK=1` are set for local
  installs, CI and the image build.
- **Monitoring image must be built from this repository.** The vendor's `dokploy/monitoring` image
  ran with the Docker socket, host networking and the host's `/proc` and `/sys`, and could not be
  checked against our source. Server monitoring now requires `MONITORING_IMAGE`:

  ```bash
  docker build -f Dockerfile.monitoring -t registry.example.com/platform/monitoring:1.0 .
  docker push registry.example.com/platform/monitoring:1.0
  # set on the platform service:
  MONITORING_IMAGE=registry.example.com/platform/monitoring:1.0
  ```

  Without it, enabling monitoring stops with a message explaining this. Publishing our own image
  from CI is roadmap item 007.
- **Upstream release workflow removed.** `.github/workflows/dokploy.yml` pushed images to the
  vendor's Docker Hub account and cloned the vendor's CLI repository; it ran (and failed) on every
  push to `canary`.

## Audited, no change needed

- `@dokploy/trpc-openapi` 0.0.18: MIT fork of trpc-openapi. No install scripts, no outbound calls
  (the only URL is a base for parsing incoming request paths); its dependencies are `co-body`, `h3`
  and `openapi3-ts`.
- `apps/monitoring` source: only outbound call is the threshold-alert callback to the platform;
  dependencies are fiber, godotenv, go-sqlite3, robfig/cron and gopsutil.
- Other runtime images are from their own projects: Traefik, PostgreSQL, Vector, cAdvisor,
  oauth2-proxy, libSQL, alpine, busybox, nginxdemos/hello.
