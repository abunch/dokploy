# Contract: `forkSso` tRPC router

All procedures require a signed-in user in the active organization. Owner/admin only unless stated.

| Procedure | Input | Output | Notes |
|---|---|---|---|
| `forkSso.listProviders` | – | providers without secrets, with settings | |
| `forkSso.createProvider` | providerId, issuer, clientId, clientSecret, domains[], settings | provider | Validates discovery; domains unique platform-wide |
| `forkSso.updateProvider` | providerId, issuer?, clientId?, clientSecret?, domains?, settings? | provider | Empty secret keeps the old one |
| `forkSso.deleteProvider` | providerId | true | Refused while it is the last provider and SSO-only is on |
| `forkSso.getSsoOnly` | – | boolean | Any signed-in user |
| `forkSso.setSsoOnly` | enabled | boolean | Owner only; needs a provider |

Public (no session): `forkSso.hasProviderForEmail` → boolean, used by the sign-in page.
