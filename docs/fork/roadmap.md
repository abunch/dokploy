# Fork Roadmap

Base: Dokploy `canary`. Governing rules: `.specify/memory/constitution.md`.

New capabilities go through Spec Kit (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement`). Integration work is tracked as GitHub issues and PRs.

## v1

| # | Work | Track | Source | Notes |
|---|------|-------|--------|-------|
| 001 | Remove `/proprietary`, stub the core files that import it, delete the license cron and gates, no phone-home | Spec Kit | Own | First feature; everything else builds on it |
| 002 | TaskFlow Swarm and reliability fixes | Issue/PR | TaskFlow-Systems/dokploy `AgentHits-Dev` | Merges cleanly onto upstream; drop its edits to `proprietary/` files; provenance check |
| 003 | OIDC SSO with IdP group → role mapping, SSO-only mode, break-glass login | Spec Kit | Milpia/mlp-dokploy `specs/001-keycloak-sso` | Seed the spec from Milpia's (Apache); 26 conflicts and 4 migrations on top of 002 |
| 004 | Audit log: always-on trail, viewer, filters, CSV export, retention | Spec Kit | Behavioural spec; ghaaf-labs/crane as design reference | Uses the existing `audit()` calls |
| 005 | Upstream PRs for AWS and Swarm | Issue/PR | Dokploy PRs #4141 (ECR), #5270, #5702, #5828, #5187, #5218/#5776, #5205, #4405, #5038 (terminal) | Port as-is with credit |
| 006 | Consolidate migrations into one chain; test upgrade from an upstream database | Issue/PR | Own | After 002–005 land |
| 007 | Rebrand, CI, image publishing, install script | Spec Kit | Own | Needs the product name |
| 008 | End-to-end QA on a multi-node Swarm in AWS | Issue | Own | Release gate |

## Later

| Work | Track | Source |
|------|-------|--------|
| Custom roles (fine-grained RBAC beyond SSO group mapping) | Spec Kit | Behavioural spec |
| Deploy-by-digest builds, Compose rolling replace, deploy queue controls | Issue/PR | DevinoSolutions/dokploy-community (cherry-pick, provenance check) |
| Reliability and performance fixes | Issue/PR | 0x00-sys/dokploy |
