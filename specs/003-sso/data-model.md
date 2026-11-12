# Data Model: Single Sign-On

## New: `fork_sso_settings`

| Column | Type | Notes |
|---|---|---|
| `provider_id` | text, PK, FK → `sso_provider.provider_id` on delete cascade | One row per provider |
| `groups_claim` | text, not null, default `groups` | Claim holding group names |
| `role_mappings` | jsonb, not null, default `[]` | `[{ group: string, role: "admin" \| "member" }]` |
| `default_role` | text, not null, default `member` | `admin` or `member` |
| `require_mapped_group` | boolean, not null, default false | Refuse sign-in without a mapped group |

## Existing, now used

- `sso_provider` (upstream): issuer, OIDC config JSON, domain list (comma-separated), organization.
- `web_server_settings.enforceSSO`: SSO-only switch.
- `user.trustedOrigins` (owners): includes each provider's issuer origin.
