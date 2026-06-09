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

- [ ] `POST /poll` ingests from ≥3 Tier-1 sources (e.g. one ATS + RemoteOK + Remotive) into the DB
- [ ] Re-polling does **not** create duplicates; a job present on two sources collapses to one (`duplicateOfId` set)
- [ ] `postedAt` is correctly the original-post time for each adapter (unit tests per adapter on a saved fixture)
- [ ] LinkedIn adapter ports the POC: list + detail, just-listed via `f_TPR`; tested against a saved HTML fixture
- [ ] Scheduler runs `runPoll()` on the interval with per-source failures isolated (one bad source doesn't abort the pass)
- [ ] `pnpm lint`, `pnpm test:fast`, `pnpm build` green

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

- _not started_
