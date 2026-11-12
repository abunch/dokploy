# Quickstart: Verify SSO

1. `docker compose -f dev/authentik/docker-compose.yml up -d` and wait for
   `http://localhost:9000/application/o/dokploy/.well-known/openid-configuration`.
2. Run the platform (`pnpm dokploy:dev`), sign in as owner, Settings → SSO → add provider:
   issuer `http://localhost:9000/application/o/dokploy/`, client `dokploy-dev` /
   `dokploy-dev-client-secret`, domain `dokploy.test`, mapping `dokploy-admins → admin`.
3. Sign out; "Sign in with SSO" as alice, bob, carol (passwords in `dev/authentik/blueprints`):
   alice is admin, bob and carol are members.
4. Turn SSO-only on: bob's password sign-in is refused; the owner's password sign-in works.
5. `node scripts/sso-e2e.mjs` runs steps 3–4 headlessly.
