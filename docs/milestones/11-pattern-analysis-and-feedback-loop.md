---
name: 11-pattern-analysis-and-feedback-loop
status: proposed
created: 2026-06-22
---

# Milestone 11 — Pattern analysis + feedback loop (close the 4→1 arrow)

Make the system *learn*: analyze outcomes (what scored high, what got applied to, what got rejected)
to surface targeting blind spots, and feed that back into the filters/profile from M01/05b/08. This
is the arrow that turns a linear scrape→rank→apply pipeline into a loop. Realizes ADR
[0004](../adr/0004-harvest-career-ops.md) Bucket A-logic. Mapping: [[career-ops-harvest-map]].

## Goal

Over the accumulated tracking data (M10) and verdicts (M08), produce a periodic "patterns" view —
e.g. "you score remote roles higher but apply to on-site more," "rejections cluster at seniority X"
— with concrete, *suggested* edits to the `job_filters` / `fitness_profile` settings the user can
accept or ignore. The loop is human-gated: the app proposes, the user decides.

## Why (closes the loop, 4 → 1)

The well-built flow is a cycle: step-4 outcomes should retune step-1 targeting. Without this,
targeting only ever changes by hand and the system never compounds. career-ops's `analyze-patterns`
is exactly this analysis; we port the logic over our DB.

## Scope / deliverables

- **Pattern analysis (Bucket A — port logic, not I/O):** port the dimension-extraction +
  classification core of `poc/career-ops/analyze-patterns.mjs` (it keys off the same kind of
  structured fields we now store as `FitnessVerdict` from M08 — see its `MACHINE_SUMMARY_FIELDS`) →
  `apps/api/src/insights/patterns.ts`, reading **DB rows** (verdicts + tracking outcomes) instead of
  parsing `applications.md` + report files.
- **Insights output:** a structured `Patterns` result (Zod, in `packages/shared`) — distributions,
  notable correlations, and concrete *suggested* filter/profile deltas with a one-line rationale each.
- **Optional LLM summary (Bucket B):** one llmgw call to turn the raw stats into a short narrative +
  the suggested edits (the stats themselves are deterministic; the LLM only phrases + proposes).
- **API + web:** `GET /insights/patterns`; a web "patterns" view; **one-click apply** of a suggested
  edit writes back to the `job_filters` / `fitness_profile` settings (the literal 4→1 wire),
  always confirmed by the user.

## Exit criteria

- [ ] `patterns.ts` computes distributions + correlations from DB outcome data (unit tests on the ported logic)
- [ ] `GET /insights/patterns` returns structured insights + suggested filter/profile deltas
- [ ] Web shows the patterns view; accepting a suggestion updates the settings (and the next poll reflects it)
- [ ] Suggestions are advisory + user-confirmed — never auto-applied
- [ ] `pnpm lint` / `typecheck` / `test:fast` / `build` green

## Decisions (locked)

- Stats are **deterministic**; the LLM only narrates + proposes (keeps insights reproducible/cheap).
- Feedback is **human-gated** — the loop suggests edits, the user accepts; no silent self-tuning.

## Open questions

- Minimum sample size before patterns are meaningful (career-ops uses a `--min-threshold`); pick a default.
- Cadence of the analysis — on demand, or a scheduled weekly digest alongside the poll scheduler?

## Dependencies

Needs M10 (outcome/status data) and M08 (structured verdicts) to have accumulated real data; writes
back to the M01/05b settings (`job_filters`, `fitness_profile`).
