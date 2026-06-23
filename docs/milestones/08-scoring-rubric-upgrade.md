---
name: 08-scoring-rubric-upgrade
status: proposed
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

- [ ] New jobs get a `FitnessVerdict` (Zod-valid) from one llmgw call; malformed output retries/fails closed
- [ ] `minScore` filtering + ranking still work against the new `score` field (back-compat)
- [ ] Feed card + detail panel render strengths / hard stops / gaps
- [ ] Batch scoring stays on the cheap model and only scores new + filter-passing jobs (no regression)
- [ ] `pnpm lint` / `typecheck` / `test:fast` / `build` green

## Decisions (locked)

- Keep a single numeric `score` for sort/filter back-compat; the rubric *enriches*, doesn't replace, ranking.
- Structured output validated by Zod at the boundary (model retries on mismatch) — same pattern reused in M09–11.

## Open questions

- Final sub-score dimensions to keep from A–G (career-ops's set is AI-role-flavored; trim to ours).
- Whether to re-score existing jobs on a profile change, or only score-forward (cost vs consistency).
