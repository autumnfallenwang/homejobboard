---
name: 02-data-model-and-shared-schema
status: done
created: 2026-06-08
---

# Milestone 02 — Data model & shared schema

Define the normalized `Job` model, the `JobFilters` config, and the `Source` adapter interface in
`packages/shared`, and back them with Drizzle/Postgres tables. This is the contract every later
milestone builds on. Realizes ADR [0003](../adr/0003-normalized-job-model-and-source-interface.md).

## Goal

`packages/shared` exports the Zod schemas + TS types for `Job`, `JobFilters`, `Source`,
`JobSummary`, `JobDetail`, and `JobScore`; `apps/api` has Drizzle tables + a clean migration that
`drizzle-kit push` applies to the local DB; a seed inserts a couple of `source` rows.

## Scope / deliverables

`packages/shared/src/`:
- **`job.ts`** — `jobSchema` (normalized model, ADR 0003 fields): `source`, `sourceJobId`, `url`,
  `applyUrl?`, `title`, `company`, `location?`, `workplaceType?` (`remote|hybrid|onsite`),
  `postedAt` (ISO), `description?`, `salaryMin?`, `salaryMax?`, `employmentType?`, `seniority?`,
  `tags?`, `fetchedAt`, `dedupKey`. Plus `jobSummarySchema` (stage-1 subset) and `jobDetailSchema`.
- **`filters.ts`** — `jobFiltersSchema`: `keywords[]`, `location?`, `workplaceType?`, `seniority?`,
  `postedSince?` (duration), `sources?` (subset). The cross-source filter config.
- **`source.ts`** — the `Source` interface type (`id`, `search(filters)`, `fetchDetail(summary)`) +
  `sourceConfigSchema` (id, kind, enabled, params e.g. ATS company token).
- **`score.ts`** — `jobScoreSchema`: `jobId`, `fitness` (0–100), `reasons?`, `model`, `scoredAt`,
  `composite` (fitness × freshness).
- barrel `index.ts` re-exports all.

`apps/api/src/db/`:
- **`schema.ts`** (Drizzle): tables —
  - `sources` (id, kind, enabled, params jsonb, lastPolledAt)
  - `jobs` (id, source, sourceJobId, url, applyUrl, title, company, location, workplaceType,
    postedAt, description, salaryMin, salaryMax, employmentType, seniority, tags jsonb, fetchedAt,
    dedupKey, duplicateOfId) — unique `(source, sourceJobId)`, index on `dedupKey`, index on `postedAt`
  - `job_scores` (id, jobId, fitness, reasons jsonb, model, scoredAt, composite)
- **`index.ts`** — Drizzle client from `DATABASE_URL`
- **`seed.ts`** — insert initial `sources` rows (e.g. a few ATS tokens, remoteok, remotive)
- `drizzle.config.ts`, `drizzle-kit` wired into `package.json`

## Exit criteria

- [x] `db:generate` + `db:migrate` apply the schema to the local DB with no error; `seed.ts` is
      idempotent (verified: 2 runs → 4 source rows). *(House pattern generate+migrate, not `push`.)*
- [x] `@homejobboard/shared` types import cleanly in both `apps/api` and `apps/web` (build green)
- [x] Unit tests: Zod schemas + `dedupKey()` parse representative fixtures and reject bad input
- [x] `pnpm lint`, `pnpm test:fast`, `pnpm build` green (+ live integration test: CRUD/unique/cascade)

## Decisions (locked)

- **`Job` is a superset with nullable fields** — sources fill what they have (ADR 0003). UI must
  tolerate missing salary/seniority/location.
- **Dedup is two-layered:** `(source, sourceJobId)` unique within a source; `dedupKey =
  normalize(company+title+location)` + `duplicateOfId` across sources (the `homenews`
  `duplicateOfId` pattern).
- **`postedAt` = original-post time**, normalized per source from `first_published`/`createdAt`/
  `publishedAt`/`pubDate`/epoch — never `updated_at`.

## Open questions

- Final `JobFilters` field list (depends on standing question #1).
- Whether `tags`/`seniority` are free-form strings or enums (start free-form; tighten later).

## Progress

- 2026-06-08: Defined the data contract — `packages/shared` now exports `Job`/`JobSummary`/`JobDetail`,
  `JobFilters`, the `Source` interface + `SourceConfig`, `JobScore`, and a pure `dedupKey()` helper
  (`job.ts`/`filters.ts`/`source.ts`/`score.ts` + barrel). `apps/api` got the Drizzle layer: `sources`
  / `jobs` / `job_scores` tables (`db/schema.ts`), the postgres-js client (`db/index.ts`,
  snake_case casing + `closeDb()`), `drizzle.config.ts`, an idempotent `seed.ts`, and the generated
  `drizzle/0000_windy_morbius.sql`. Verified live against Docker Postgres: generate → migrate → seed×2
  (4 rows, idempotent) → integration test (CRUD + unique(source,sourceJobId) + score cascade) all pass.
  Check loop green: lint ✓ typecheck ✓ test:fast (shared 7, api 5) ✓ build ✓. **All M02 exit criteria met.**

## Outcome

The normalized `Job` model, `Source` adapter interface, and Drizzle tables are in place — the contract
M03 builds adapters against. Deviations from the plan: (1) **generate+migrate** (committing
`drizzle/`), not `drizzle-kit push` — matches the sibling repos and keeps migrations reviewable;
(2) `tags`/`reasons` stored as `text[]` (not jsonb). `JobFilters` is a sensible v1 (standing Q#1) and
the seeded ATS tokens (`greenhouse:stripe`, `lever:netflix`) are examples pending the real curated
list (standing Q#2). No blockers for M03.

Closed: 2026-06-08

