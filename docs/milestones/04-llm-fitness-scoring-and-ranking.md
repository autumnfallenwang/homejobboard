---
name: 04-llm-fitness-scoring-and-ranking
status: active
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

- [ ] New jobs from a poll get scored exactly once; re-running does not re-score
- [ ] `fitness` and `reasons` are persisted; bad/again-failing LLM responses are retried then skipped (not fatal)
- [ ] `GET /jobs?sort=rank` returns composite-ranked jobs; freshness decay visibly affects order
- [ ] Scoring only touches new/deduped/filter-passing jobs (cost guard verified)
- [ ] `pnpm lint`, `pnpm test:fast`, `pnpm build` green (LLM call mocked in tests)

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

- _not started_
