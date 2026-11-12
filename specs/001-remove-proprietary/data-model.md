# Data Model: Remove Proprietary Code and Phone-Home

No tables or columns are added, changed or dropped.

| Table / columns | Before | After |
|---|---|---|
| `user.licenseKey`, `user.enableEnterpriseFeatures`, `user.isValidEnterpriseLicense` | Read by the license gate and cron | Kept, never read or written |
| `organization_role` | Enforced only with a license; edited by proprietary UI | Always enforced; read-only until custom roles return |
| `member.accessedServers`, `member.accessedGitProviders` | Applied only with a license | Always applied |
| `organization` default role (`default_role`) | Resolved by proprietary code | Resolved by `getOrganizationDefaultRole`: built-in role, or a custom role that still exists, else `member` |
| `audit_log` | Written by proprietary code | Written by `writeAuditLog`; same columns; write failures never fail the caller |
| `sso_provider`, `scim_provider`, `forward_auth_settings` | Managed by proprietary UI | Kept; used only by the open plugins and forward-auth routing that already read them |
| Whitelabel settings | Read by proprietary UI | Kept, ignored |
| `web_server_settings.enforceSSO` | Blocks password sign-in | Ignored |
| `web_server_settings.remoteServersOnly` | License-gated toggle | Owner/admin toggle |
