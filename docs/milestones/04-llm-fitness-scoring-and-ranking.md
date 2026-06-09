---
name: 04-llm-fitness-scoring-and-ranking
status: done
created: 2026-06-08
---

# Milestone 04 — LLM fitness scoring & ranking

Score new jobs for personal fitness via the cluster `llmgw` gateway, and combine fitness with
freshness into a composite rank. Scoring is decoupled from ingestion (ADR
[0003](../adr/0003-normalized-job-model-and-source-interface.md)) — only new, deduped,
filter-passing jobs are scored.

## Goal

After a poll, unscored jobs get a `job_scores` row with a `fitness` (0–100), short `reasons`, and a
`composite` (fitness × freshness). `GET /jobs?sort=rank` returns jobs ranked by composite.

## Scope / deliverables

`apps/api/src/services/`:
- **`llm-client.ts`** — minimal client for the cluster `llmgw` (reuse the homenews pattern: hit the
  existing ingress, no separate dev gateway). Reads `LLMGW_URL`; structured JSON output.
- **`score.ts`** — `scoreJob(job, profile)`: prompt the model with the job (title/company/location/
  description + key fields) and the user's **fitness profile/criteria**; parse `{fitness, reasons}`;
  write `job_scores`. Batched, rate-limited; skip already-scored jobs.
- **`rank.ts`** — `composite = fitness × freshness`, `freshness` = exponential decay from `postedAt`
  (homenews-style). Used by the `/jobs?sort=rank` query.
- Wire scoring into the poll pass (after ingest) and/or a `POST /score` trigger.

`packages/shared` — extend `jobScoreSchema` if needed; add the `fitnessProfile` schema (the user's
criteria the score is judged against).

## Exit criteria

- [x] New jobs get scored exactly once; re-running does not re-score (integration test + idempotent `insertScore`)
- [x] `fitness` and `reasons` are persisted; primary-failure falls back to the fallback model, twice-failing jobs are skipped (logged, not fatal)
- [x] `GET /jobs?sort=rank` returns composite-ranked jobs with a **live** freshness recompute affecting order
- [x] Scoring only touches non-duplicate, unscored jobs (cost guard = `unscoredJobs` filter; verified live + in tests)
- [x] `pnpm lint`, `pnpm test:fast`, `pnpm build` green (LLM mocked in tests; **real llmgw smoke** also passed)

## Decisions (locked)

- **Decoupled scoring** — never score the whole pull; only new+deduped+filter-passing jobs.
- **`llmgw` reuse** — dev hits the cluster's existing gateway ingress, no separate dev LLM process
  (homenews pattern).
- **Composite = fitness × freshness** — a great-fit stale job still ranks below a great-fit fresh one.

## Open questions

- The **fitness profile**: what the user's ideal job looks like (role, stack, level, location/remote,
  comp, dealbreakers) — standing question #4. **Blocking for meaningful scores.**
- Which `llmgw` model + token budget per job.
- Whether `reasons` are shown in the UI (M05) or kept internal.

## Progress

- 2026-06-08: Built LLM fitness scoring + ranking. Added a key/value **`settings`** table
  (`db/schema.ts` + migration `0001`, `services/settings.ts` with defaults: fitness_profile,
  llm_model_fitness=`claude-haiku-4-5`, fallback `gemma4:26b`, score_batch_size), the **`llm-client.ts`**
  (OpenAI SDK → `${LLM_GATEWAY_URL}/v1`), **`services/score.ts`** (buildFitnessPrompt + extractJson +
  bounds-validate + fallback model; `scoreUnscoredJobs` cost-guarded to non-dup unscored jobs), shared
  pure **`freshness`/`composite`** helpers, `db/queries.ts` (`unscoredJobs`/`insertScore`/`listRankedJobs`
  with live composite), routes **`POST /score`** + **`GET /jobs?sort=rank`** (+ score on `/jobs/:id`),
  and wired scoring into the scheduler tick (poll → score) + `seedDefaultSettings` on boot. Renamed env
  `LLMGW_URL`→`LLM_GATEWAY_URL`. Check loop green: lint ✓ typecheck ✓ test:fast (shared 10, api 26) ✓;
  live integration (mocked LLM) 33 tests ✓; build ✓. **Real llmgw smoke:** scored 5 remoteok jobs via
  `claude-haiku-4-5` — ranked feed showed sensible fitness + reasons (Applied AI Engineer 62 docked for
  non-US, catering "Buffer" job 5). **All M04 exit criteria met.**

## Outcome

Jobs now get an LLM fitness score (0–100) + reasons against a stored, user-editable profile, and the
feed ranks by live `fitness × freshness`. Scoring is decoupled + cost-guarded (only new non-duplicate
jobs, batched) and runs automatically after each scheduled poll. The seeded **fitness profile is a
placeholder** — the user refines it via the `fitness_profile` setting (or the M05 UI) for better scores.
HN + Tier-2 sources remain deferred. Next: M05 web frontend surfaces this ranked feed.

Closed: 2026-06-08
