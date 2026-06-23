---
name: 08-scoring-rubric-upgrade
status: done
created: 2026-06-22
---

# Milestone 08 — Scoring rubric upgrade (structured fitness)

Replace the thin single-number fitness score (M04) with career-ops's structured A–G evaluation
rubric, emitted as validated JSON so the feed can rank, filter, and *explain* each job. Realizes
ADR [0004](../adr/0004-harvest-career-ops.md) Bucket B (prompt artifacts). Mapping: [[career-ops-harvest-map]].

## Goal

Every newly-ingested, filter-passing job gets a structured verdict — score + sub-scores + top
strengths + hard stops/gaps + one-line rationale — produced by **one** llmgw call against a ported
rubric prompt, validated by a Zod schema, and stored for the ranked feed. The user opens the app to
a queue they can triage in minutes because each card says *why*.

## Why (flow step 3a)

Scoring is automatic and runs on volume, so it stays on the cheap model (haiku via llmgw, as M04).
The upgrade is in **prompt quality + output structure**, not pipeline shape. Explainability is what
makes a 30-job queue reviewable; a bare number isn't.

## Scope / deliverables

- **Prompt port (Bucket B):** adapt `poc/career-ops/modes/oferta.md` (Blocks A–G + the
  `## Machine Summary` structured fields) into a prompt template in `apps/api/src/scoring/` that
  takes `(job, fitnessProfile)` and returns the rubric verdict. Strip career-ops-specific framing
  (report files, tracker, PDF) — keep the rubric + the structured-summary contract.
- **Schema (shared):** a `FitnessVerdict` Zod schema in `packages/shared` — `score` (kept
  compatible with current `minScore` filtering), `subScores` (the A–G dimensions), `topStrengths[]`,
  `hardStops[]`, `softGaps[]`, `rationale`, `confidence`. This is the API↔web contract for verdicts.
- **Scoring service:** update the M04 llmgw call to request the structured verdict (JSON / tool-style
  structured output), validate with Zod, persist; keep the existing batch + "new jobs only" decoupling.
- **Profile schema (Bucket B):** widen the `fitness_profile` setting from a free string toward the
  career-ops profile *shape* (strengths, archetypes, dealbreakers, comp target) — borrow the schema
  from `poc/career-ops/config/profile.example.yml` / `modes/_profile.template.md`; still user-editable
  in settings.
- **Web:** surface the new fields on feed cards (top reason already shown in 05b) + the detail
  verdict panel (hard stops / gaps / sub-scores).

## Exit criteria

- [x] New jobs get a `FitnessVerdict` (Zod-valid) from one llmgw call; malformed output retries/fails closed
- [x] `minScore` filtering + ranking still work against the new `score` field (back-compat) — feed `sort=rank` + minScore unchanged; old (verdict-null) rows still render score + reasons
- [x] Feed card + detail panel render strengths / hard stops / gaps — browser-verified (verdict panel + recommendation chip)
- [x] Batch scoring stays on the cheap model and only scores new + filter-passing jobs (no regression) — design unchanged; the cheap model (haiku) is currently unreachable via the gateway's Anthropic backend so the live pass used the local fallback (infra outage, see Outcome)
- [x] `pnpm lint` / `typecheck` / `test:fast` (83) / `build` green

## Decisions (locked)

- Keep a single numeric `score` for sort/filter back-compat; the rubric *enriches*, doesn't replace, ranking.
- Structured output validated by Zod at the boundary (model retries on mismatch) — same pattern reused in M09–11.

## Open questions

- ~~Final sub-score dimensions~~ — resolved: `{skills, seniority, domain, compensation, logistics}` (0–5 each).
- ~~Re-score on profile change~~ — resolved: score-forward only (the profile editor already states this).

## Progress

- 2026-06-22: Shipped the structured `FitnessVerdict` (ADR 0004 Bucket B). `packages/shared/src/score.ts`
  gains `fitnessVerdictSchema` (recommendation + 5 sub-scores + topStrengths/hardStops/softGaps +
  rationale + confidence) and `jobScoreSchema.verdict`. New `apps/api/src/scoring/rubric.ts`
  (ported/trimmed `oferta.md` prompt + `parseFitnessVerdict` Zod-validation); `services/score.ts` emits
  `{fitness, verdict}` in one llmgw call, persists to a new `job_scores.verdict` jsonb column (migration
  `0003`), keeps `fitness`/`reasons`/`composite` for back-compat. Web: `verdict-panel.tsx` (detail
  sub-score bars + strengths/stops/gaps), recommendation chip on the feed card, `format.ts` helpers.
  lint / typecheck / test:fast (83) / build all green.
- 2026-06-22: **Live score smoke** (real llmgw + dev DB) — scored 3 jobs; verdicts persisted as valid
  JSON with sensible content (e.g. a claims-processor role correctly skipped with hard stops "Not a
  software engineering role" / "Compensation far below target"). **All 3 used the `gemma4:26b` fallback
  because the gateway's Anthropic backend is currently down** (`500 anthropic_auth_failed` —
  `Anthropic token refresh failed: invalid_grant`), so `claude-haiku-4-5` (primary) is unreachable. This
  is an **infra/ops issue at llmgw, not an M08 defect** — the fail-closed primary→fallback path handled
  it and produced schema-valid verdicts. The cheap-model (haiku) path is unverifiable until the gateway's
  Anthropic auth is restored.
- 2026-06-22: **Browser UI smoke** (chrome-devtools MCP against the running app + dev DB) — detail
  verdict panel renders (SKIP chip, HIGH confidence, 5 sub-score bars, hard-stops list); feed card shows
  the recommendation chip + verdict rationale; old (verdict-null) scores degrade to fitness + reasons,
  no chip; unscored jobs show "—". All three render states verified.

## Outcome

**Closed: 2026-06-22.** Shipped the structured `FitnessVerdict` (ADR 0004 Bucket B): one Zod-validated
llmgw call per new job now returns a recommendation + 5 sub-scores (`skills/seniority/domain/
compensation/logistics`) + topStrengths/hardStops/softGaps + rationale + confidence, stored in a new
`job_scores.verdict` jsonb column (migration `0003`). The 0–100 `fitness` stays the canonical
sort/filter score (back-compat); old/unscored rows degrade gracefully. New `apps/api/src/scoring/`
holds the ported (trimmed) `oferta.md` prompt + `parseFitnessVerdict`. Web gained a detail verdict
panel + feed recommendation chip. lint / typecheck / test:fast (83) / build green; live-scored and
browser-smoke verified.

**Deviation / caveat:** the live scoring ran on the **local fallback** (`gemma4:26b`) because the
gateway's Anthropic backend was down (`500 anthropic_auth_failed`), so the intended cheap primary
(`claude-haiku-4-5`) is unverified until that infra is restored. The fail-closed primary→fallback
design handled it correctly. Captured in [[llmgw-gateway]].

**Decisions (confirmed):** 5 sub-score dims; `fitness_profile` stays free-text (structured profile
deferred to M09, where material generation needs typed fields); score-forward only. Dropped from
career-ops for M08 (scope): `legitimacy_tier` (overlaps M07 liveness), `archetype`/`next_action` (M09+).
