---
name: 01-monorepo-bootstrap
status: done
created: 2026-06-08
---

# Milestone 01 — Monorepo bootstrap

Stand up the empty Turborepo skeleton that mirrors `homenews`/`homework`/`homecal` exactly, so every
later milestone has the right home. No business logic — just the scaffold, tooling, and a green dev
loop with the web→api hop working end to end.

## Goal

`pnpm dev` brings up `apps/api` (Hono, :3001), `apps/web` (Next.js, :3000), and a local Postgres
(:5432) container; the web app fetches `/health` from the API and renders "ok". `pnpm build`,
`pnpm lint`, `pnpm test:fast` all pass on an empty repo.

## Scope / deliverables

Root tooling (copy the house pattern — `homecal`/`homework` is the canonical baseline):
- `pnpm-workspace.yaml` → `packages: ["apps/*", "packages/*"]`
- `turbo.json` — `dev`, `build`, `test`, `test:fast`, `lint`, `lint:fix` pipelines
- root `package.json` — `packageManager: pnpm@10.29.3`, turbo scripts, `predev: ./scripts/db-start.sh`
- root `tsconfig.json` (ES2022, strict), `biome.json` (line width 100), `.dockerignore`
- extend `.gitignore` (keep the existing `poc/` ignore) with node/turbo/next/env entries

`apps/api/` (Hono on `@hono/node-server`):
- `src/index.ts` — HTTP server on `process.env.API_PORT ?? 3001`
- `src/app.ts` — Hono app, request-log middleware, CORS, `GET /health → {status:"ok"}`
- `src/config.ts` — env loading (`DATABASE_URL`, `API_PORT`, `LOG_LEVEL`, `LLMGW_URL`)
- `package.json` (`@homejobboard/api`): `dev: tsx watch --env-file=.env src/index.ts`,
  `start: tsx src/index.ts`, `test`, `test:fast`, `lint`; `build: tsc --noEmit`
- `.env.example` — `DATABASE_URL=postgresql://homejobboard:homejobboard@localhost:5432/homejobboard`

`apps/web/` (Next.js App Router):
- `src/lib/api.ts` — dual-context base URL: `API_URL ?? NEXT_PUBLIC_API_URL ?? http://localhost:3001`
- `src/app/layout.tsx` + a placeholder home page that calls `/health` and shows the result
- `package.json` (`@homejobboard/web`): `dev: next dev --port 3000`, `build`, `start`, `lint`
- `next.config.mjs` (standalone output), Tailwind v4 baseline

`packages/shared/` (`@homejobboard/shared`):
- `src/index.ts` — placeholder export for now (the `Job`/`JobFilters`/`Source` schemas land in M02)
- `package.json` (dep: `zod`), `tsconfig.json`

`scripts/`:
- `db-start.sh` / `db-stop.sh` / `db-reset.sh` — local `homejobboard-postgres` container,
  `postgres:17-alpine`, volume `homejobboard-pgdata`, host port 5432, creds
  `homejobboard/homejobboard/homejobboard`, `pg_isready` wait loop

## Exit criteria

- [x] `pnpm install` clean on a fresh clone
- [x] `pnpm dev`/built servers start; `http://localhost:3000` shows API `/health` = ok — **verified live** (api `/health`→`{"status":"ok"}`, web home rendered `API health: ok`)
- [x] `pnpm build`, `pnpm test:fast`, `pnpm lint` (+ `typecheck`) all pass
- [x] `apps/web/src/lib/api.ts` resolves the API URL with no env config in dev
- [x] Workspaces resolve: `apps/web` + `apps/api` import `@homejobboard/shared` (web build transpiles it)

## Decisions (locked)

- **DB image:** `postgres:17-alpine` (homecal style). No pgvector at MVP — fitness scoring stores a
  numeric score, not embeddings (revisit only if we add semantic dedup/search).
- **Ports:** local api 3001 / web 3000 / db 5432; cluster ports set in M06.
- **Package names:** `@homejobboard/{api,web,shared}`; images `ghcr.io/<owner>/homejobboard-{api,web}`
  (owner confirmed in M06).

## Open questions

- None blocking. (Auth is out of scope for the whole project — single-user, self-hosted.)

## Progress

- 2026-06-08: Scaffolded the Turborepo skeleton mirroring `homework`/`homecal` — root tooling
  (pnpm-workspace, turbo.json, tsconfig, biome, .dockerignore, extended .gitignore), `apps/api`
  (Hono + `/health` + pino logger + requestLogger + config), `apps/web` (Next App Router, dual-context
  `api.ts`, Tailwind v4 baseline, `force-dynamic` `/health` page), `packages/shared` (placeholder
  export), and `scripts/db-{start,stop,reset}.sh`. Check loop green: lint ✓ typecheck ✓ test:fast (api
  2 tests) ✓ build ✓. Live runtime verified end-to-end: api `/health`→`{"status":"ok"}`, web home
  rendered `API health: ok`. **All M01 exit criteria met.**

## Outcome

Empty-but-green monorepo skeleton, mirroring the sibling home* repos, with a verified web→api health
hop. Deviations from the plan: (1) DB name `homejobboard_dev` (matches the `_dev` house convention,
not the bare `homejobboard` in the plan); (2) `--passWithNoTests` added to `shared`/`web` test scripts
since they have no tests yet in M01 (api keeps its real test); (3) lean web deps — Next + React +
Tailwind v4 only, deferring shadcn/radix/lucide to M05. No blockers for M02.

Closed: 2026-06-08

