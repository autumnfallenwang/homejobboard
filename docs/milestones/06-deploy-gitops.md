---
name: 06-deploy-gitops
status: onhold
created: 2026-06-08
---

# Milestone 06 — Deploy & GitOps

Ship homejobboard to the home k3s cluster the same way the sibling repos deploy: Dockerfiles → GHCR
images → Helm chart → Argo CD GitOps via `arch-infra`.

## Goal

`git push origin main` builds + pushes both images, bumps the chart tags in `arch-infra`, and Argo CD
rolls api + web. The app is reachable at `http://homejobboard.arch.local`, polling sources and scoring
on schedule against a cluster Postgres.

## Scope / deliverables

- **Dockerfiles** for `apps/api` and `apps/web` (standalone Next output); `.dockerignore`.
- **`deploy/chart/`** — Helm chart (mirror homenews/homework): api + web Deployments/Services/Ingress,
  Postgres (statefulset or managed), env wiring (`DATABASE_URL`, `LLMGW_URL`, source API keys as
  secrets), the poll scheduler running in the api pod.
- **Cluster ports** — assign api/web ports (homejobboard range), set in chart values.
- **CI** (`build.yml`) — run `test:fast`, build + push `ghcr.io/<owner>/homejobboard-{api,web}` at the
  commit SHA, bump tags in `arch-infra/apps/homejobboard.yaml`.
- **arch-infra registration** — add `homejobboard.yaml` (app-of-apps), ingress host
  `homejobboard.arch.local`, secrets for source keys.
- **DB ops** — `drizzle-kit push` + `seed.ts` runnable in the api pod (homenews pattern).

## Exit criteria

- [ ] Both images build in CI and push to GHCR at the SHA
- [ ] Argo CD syncs the chart; api + web pods healthy; ingress serves `homejobboard.arch.local`
- [ ] Schema applied + sources seeded in the cluster DB; a scheduled poll ingests + scores in-cluster
- [ ] Secrets (Adzuna/USAJobs/JSearch keys, llmgw) injected via the chart, not committed
- [ ] `git push` → build → tag bump → rollout works end to end

## Decisions (locked)

- **GitOps via arch-infra / Argo CD** — humans push; CI + Argo CD do the rest (homenews pattern).
- **12-factor** — dev and prod run identical code; only env differs.
- **Secrets via chart values / cluster secrets** — never committed.

## Open questions

- GHCR owner / image org (confirm the account).
- Postgres in-cluster (statefulset) vs an existing shared instance.
- Cluster timezone / poll schedule.
- arch-infra registration: open the PR myself or hand over `homejobboard.yaml`.

## Progress

- _not started_
