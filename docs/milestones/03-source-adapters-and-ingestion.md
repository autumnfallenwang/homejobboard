---
name: 03-source-adapters-and-ingestion
status: active
created: 2026-06-08
---

# Milestone 03 — Source adapters & ingestion

Implement the `Source` adapter interface and the Tier-1 adapters, plus the ingestion pipeline
(fetch → normalize → dedup → store) and a poll scheduler. This is where jobs first land in the DB.
Realizes ADRs [0002](../adr/0002-job-source-access-strategy.md) / [0003](../adr/0003-normalized-job-model-and-source-interface.md).
Per-source endpoints/fields: `knowledge/job-source-access-catalog.md`.

## Goal

A `runPoll()` pass pulls jobs from all enabled sources via their adapters, normalizes them to the
`Job` model, dedups, and upserts new ones into Postgres; a scheduler runs it on an interval. Visible
via `GET /jobs?...` returning stored, deduped jobs newest-first.

## Scope / deliverables

`apps/api/src/sources/`:
- **`types.ts`** — re-export the `Source` interface; a `registry` of enabled adapters built from `sources` rows.
- **Tier-1 adapters (build these first):**
  - `greenhouse.ts` — `GET boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true`; map
    `first_published`→`postedAt`, `content`→`description`. One adapter instance per company token.
  - `lever.ts` — `GET api.lever.co/v0/postings/{company}?mode=json`; `createdAt`(ms)→`postedAt`.
  - `ashby.ts` — `GET api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true`;
    `publishedAt`→`postedAt`.
  - `remoteok.ts` — `GET remoteok.com/api` (skip element[0] legal); full `description` inline; honor
    the link-back ToS. `date`→`postedAt`.
  - `remotive.ts` — `GET remotive.com/api/remote-jobs`; `publication_date`→`postedAt`.
  - `wwr.ts` — We Work Remotely RSS; `pubDate`→`postedAt`.
  - `hn-hiring.ts` — HN Algolia/Firebase API on the latest "Who is Hiring" thread; comment `time`→`postedAt`.
- **Tier-2 (add once keys provided — non-blocking):** `adzuna.ts` (`sort_by=date`, `max_days_old`),
  `usajobs.ts` (`DatePosted`). Read keys from env; if absent, adapter self-disables with a log line.
- **Tier-3 (port the validated POC):** `linkedin.ts` — guest list (`f_TPR`/`sortBy=DD`) + detail
  fetch; this is the only adapter with a real `fetchDetail` Stage 2. Polite, low volume, retry/backoff.

`apps/api/src/services/`:
- **`ingest.ts`** — `runPoll()`: for each enabled source → `search(filters)` → (Tier-3) `fetchDetail`
  → normalize → compute `dedupKey` → dedup (within + cross source) → upsert new jobs; update
  `sources.lastPolledAt`. "New" = unseen `(source, sourceJobId)`.
- **`dedup.ts`** — `normalize(company+title+location)` key; mark `duplicateOfId`, keep richest description.
- **`scheduler.ts`** — interval poll (env `POLL_INTERVAL`), with per-source error isolation + logging.

`apps/api/src/routes/`:
- `GET /jobs` (filter, paginate, newest-first), `GET /jobs/:id`, `POST /poll` (manual trigger),
  `GET /sources` / `PATCH /sources/:id` (enable/disable, edit params).

## Exit criteria

- [x] `POST /poll` ingests from ≥3 Tier-1 sources (4: RemoteOK, Remotive, Greenhouse, Lever) into the DB — **verified live: 764 jobs**
- [x] Re-polling does **not** create duplicates (verified: 2nd poll inserted 0); cross-source `duplicateOfId` collapse verified in the ingest integration test
- [x] `postedAt` is correctly the original-post time for each adapter (per-adapter parse unit tests on POC fixtures)
- [ ] LinkedIn adapter ports the POC: list + detail, just-listed via `f_TPR` — **deferred to part 2**
- [ ] Scheduler runs `runPoll()` on the interval, per-source failures isolated — **deferred to part 2** (error isolation itself is done; cron not yet)
- [x] `pnpm lint`, `pnpm test:fast`, `pnpm build` green

## Decisions (locked)

- **Adapters are pure-ish:** network in, `JobSummary[]`/`JobDetail` out; no DB writes inside adapters
  (the pipeline owns persistence) — keeps them unit-testable against fixtures.
- **Per-source error isolation:** a failing source logs + skips; never aborts the whole poll.
- **ATS needs a company list** — seeded from `sources` rows; see `knowledge/ats-company-slug-sourcing.md`.
- **Fixtures from the POC:** reuse the shapes proven in the research round; keep saved sample responses
  as test fixtures (the live `poc/` folder is gitignored, so copy needed fixtures into `apps/api`’s tests).

## Open questions

- ATS company-token seed list (standing question #2) — **blocking for the ATS adapters** (the feed
  adapters are not blocked).
- Adzuna/USAJobs/JSearch keys (standing question #3) — non-blocking.
- Poll interval default and whether per-source intervals are needed.

## Progress

- 2026-06-08 (part 1): Built the source layer + ingestion pipeline. Added the `Source` registry
  (`sources/registry.ts`), four Tier-1 adapters (`greenhouse`/`lever`/`remoteok`/`remotive` — each a
  pure `parse*` + a `fetch→parse` `search()`), a shared `http.ts`, the `runPoll()` pipeline
  (`services/ingest.ts`: normalize → `dedupKey` → `onConflictDoNothing` insert → cross-source dedup
  via `services/dedup.ts`), `db/queries.ts`, and routes `GET /jobs`, `GET /jobs/:id`, `GET /sources`,
  `PATCH /sources/:id`, `POST /poll`. Committed fixtures derived from the POC raw samples. Check loop
  green: lint ✓ typecheck ✓ test:fast (shared 7, api 13) ✓; live integration tests (idempotency +
  cross-source dedup) ✓; build ✓. **Live smoke:** `POST /poll` ingested **764 jobs** from all 4
  sources, 2nd poll inserted 0 (idempotent), source filter + `lastPolledAt` verified.
- **Part 2 remaining (M03 stays open):** We Work Remotely + HN adapters, the **LinkedIn guest adapter**
  (real Stage-2 `fetchDetail` + HTML parse), the **node-cron scheduler**, and Tier-2 key adapters
  (Adzuna/USAJobs). Also swapped the seed's Lever example `netflix`→`spotify` (netflix isn't on Lever).
