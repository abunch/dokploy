# Contract: Removed Surface

## tRPC

- `stripe.*` (whole router)
- `settings.getUpdateData`, `settings.updateServer`, `settings.getPostHogConfig`
- Billing-only fields stop being returned where they were Cloud-only.

## HTTP

- `POST /api/stripe/webhook`

## Screens

- Settings → Billing, invoices, trial banner, onboarding plan step
- "Update available" badge and update dialog
- Gravatar option on the profile page (built-in avatars stay)

## Environment variables

| Variable | Status |
|---|---|
| `IS_CLOUD` | Ignored; Cloud mode is always off |
| `DISABLE_UPDATE_CHECK`, `DISABLE_PUBLIC_IP_LOOKUP` | Removed (behaviour is now always "off") |
| `SERVER_URL`, `JOBS_URL`, `STRIPE_*`, `HUBSPOT_*`, `GTM_ID`, PostHog vars | Ignored |
| `TEMPLATES_URL` | Kept; catalog off when unset or empty |
| `ADVERTISE_ADDR` | Kept |
| `SERVER_IP` | New, optional: the platform's own address on first start |

## Workspace and images

- `apps/api`, `apps/schedules`, `Dockerfile.cloud`, `Dockerfile.server`, `Dockerfile.schedule`,
  `.github/workflows/deploy.yml`
