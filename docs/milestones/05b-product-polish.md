---
name: 05b-product-polish
status: done
created: 2026-06-10
---

# Milestone 05b — Product polish (pre-deploy)

Shape the MVP into a genuinely useful daily job-finding tool before shipping it to the
cluster (M06): wire the long-deferred `JobFilters` into ingestion, widen source coverage
with the remaining validated Tier-1 adapters, and redesign the web UI.

## Goal

Broader market coverage, filter-gated ingestion (cheaper scoring, fresher feed), and a UI
that is fast to scan and pleasant to live in.

## Scope / deliverables

- **Filters wired in** (the core premise, deferred since M03): `matchesFilters` +
  `parsePostedSince` in shared (with new `excludeKeywords` field), a `job_filters` JSON
  setting (default `{"postedSince":"14d"}`), applied inside `runPoll` before insert;
  LinkedIn translates filters server-side (`f_TPR`, keywords, location). Poll results
  now report `filtered` per source.
- **Two new Tier-1 adapters**: `ashby` (posting-api, salary via `?includeCompensation`)
  and `hn` (Algolia → latest "Who is hiring?" thread → pipe-convention comment parsing).
- **Seed expansion**: 16 starter sources — 5 Greenhouse + 3 Lever + 3 Ashby boards
  (all live-validated 2026-06-10), HN, the 3 feeds, LinkedIn.
- **API**: `GET /jobs` gains `q` / `source` (family prefix) / `minScore`; `GET /jobs/:id`
  returns `alsoSeenOn` (dedup'd duplicates); new `GET /stats`; `POST` + `DELETE /sources`
  so ATS boards are managed from the UI.
- **Web redesign** ("editorial broadsheet"): Fraunces/IBM Plex fonts, warm paper + ink
  oklch theme with dark mode, masthead stats ticker, feed with search/source/min-score
  controls + status counts + salary/top-reason on cards, detail with sticky verdict panel
  + structured description blocks + also-seen-on, settings with numbered sections
  (profile / pre-filters editor / grouped source manager with add-board form).

## Exit criteria

- [x] Poll applies `job_filters` before storing/scoring; per-source `filtered` reported
- [x] Ashby + HN adapters pass fixture tests and a live poll (16/16 sources, 0 errors)
- [x] Feed narrows by q/source/minScore; stats ticker live; sources managed from UI
- [x] Scoring path unchanged and green (12/12 live batch via llmgw)
- [x] `pnpm lint` / `typecheck` / `test:fast` (shared 18, web 11, api 29) / `build` green

## Progress

- 2026-06-10: Built and live-verified everything above. Live poll inserted 544
  filter-passing jobs across 16 sources (e.g. databricks 781 fetched → 81 kept;
  HN thread parsed 120 postings). Lever `plaid` token was dead (0 postings) — replaced
  with validated `palantir` + `zoox`. Default `job_filters` ships as
  `{"postedSince":"14d"}` so a fresh deploy doesn't ingest (and LLM-score) whole-board
  ATS history; keyword filters are opt-in via the settings UI.

## Outcome

The product loop is now the intended one: filters gate every poll, eleven boards feed the
ranked inbox, and the UI reads like a personal broadsheet — scan, open, apply, triage.
Ready for M06 (deploy & GitOps). Known follow-ups: Adzuna/USAJobs adapters still need
free keys (standing question #3); ATS token list grows via the new add-board form.

Closed: 2026-06-10
