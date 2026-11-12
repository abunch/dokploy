# Contract: API Routes Removed

These tRPC routers are removed. Clients calling them get a "not found" procedure error.

| Router | Former UI callers (edited) |
|---|---|
| `licenseKey.*` | `side.tsx`, `show-users.tsx`, `add-permissions.tsx`, `handle-forward-auth.tsx`, settings/license page |
| `sso.*` | sign-in page (`showSignInWithSSO`), settings/sso page |
| `scim.*` | settings/sso page |
| `forwardAuth.*` | `handle-forward-auth.tsx` (switches to the domain update route), settings/sso page |
| `customRole.*` | `add-invitation.tsx`, `change-role.tsx` (built-in roles plus existing custom role names from the member list), settings/users page |
| `auditLog.*` | settings/audit-logs page |
| `whitelabeling.*` | `side.tsx`, `use-whitelabeling.ts` (returns defaults) |

Unchanged but no longer license-gated: `server.allForPermissions`, `gitProvider.allForPermissions`,
`user.assignPermissions`, `organization.update` (custom default role), `settings.updateRemoteServersOnly`.

Hidden and ignored: `settings.updateEnforceSSO` is kept for API compatibility and stores the value,
which has no effect.
