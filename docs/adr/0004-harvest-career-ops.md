# 0004 — Harvest career-ops for the apply / track / scoring layers

- **Status:** accepted
- **Date:** 2026-06-22
- **Deciders:** project founder

## Context

homejobboard's MVP (M01–06) owns the hard automatic half of the job-search loop well:
profile + filter settings, the scheduled multi-source ingestion pipeline (8 adapters incl. a
working LinkedIn guest adapter), and llmgw fitness scoring into a ranked web feed. What it does
**not** yet have is the *apply* half (no tailored CV / cover-letter generation — the "send out"
is just `open applyUrl` + `applied/dismissed`, see [05](../milestones/05-web-frontend.md)) and the
*track/learn* half (no real status state-machine, no follow-up cadence, no rejection-pattern
analysis that feeds targeting back).

We evaluated **career-ops** (`https://github.com/santifer/career-ops`, **MIT**), a CLI-agent job-search
system, vendored locally at `poc/career-ops/` for reference. Its architecture is the inverse of
ours: it is strong exactly where we are thin (tailored CV/PDF, cover letters, interview prep, an
A–G evaluation rubric, a canonical-state tracker, follow-up cadence + pattern analysis) and weak
exactly where we are strong (no always-on backend, no DB, a curate-a-company-list scanner, and —
critically — **no LinkedIn path**, which our guest adapter already has).

Three forces shape the decision:
1. Most of career-ops's value is **portable**: its deterministic `.mjs` scripts are standalone
   pure-ish functions, and its `modes/*.md` are LLM "programs" that map cleanly onto our
   single-task-per-request + llmgw + Zod shape. The intelligence is not tied to its CLI harness.
2. The part of career-ops that *is* tied to its harness — the markdown-table tracker and the
   scripts that manipulate it (`merge-tracker`/`dedup-tracker`/`normalize-statuses`/`verify-pipeline`)
   — exists only to compensate for **not** having a database. We have Postgres; that code is dead
   weight for us.
3. `poc/` is **gitignored**. Vendored career-ops is a reference copy only — nothing can `import`
   from it at runtime.

## Decision

Adopt career-ops as a **parts donor**, not a dependency or a system to switch to. homejobboard
remains the spine (always-on app, DB, ingestion, UI); career-ops supplies the intelligence layer
for the apply/track/scoring halves we have not built.

Harvest in **three buckets**, and explicitly drop a fourth:

- **Bucket A — drop-in code** (standalone functions; **copy** into `apps/api`, port `.mjs`→`.ts`):
  `generate-pdf.mjs` + `templates/cv-template.html` (Playwright HTML→PDF with ATS Unicode
  normalization), `generate-cover-letter.mjs` (`buildHtml` pure fn) + `templates/cover-letter-template.html`,
  `liveness-core.mjs` (pure expired/live/uncertain classifier), `role-matcher.mjs` (fuzzy
  same-opening dedup). The **logic** (not the file I/O) of `followup-cadence.mjs` and
  `analyze-patterns.mjs`.
- **Bucket B — prompt artifacts** (adopt as *prompt template + Zod output schema* pairs, called
  once against llmgw): `modes/oferta.md` (A–G rubric + Machine-Summary structured fields),
  `modes/cover.md`, `modes/interview-prep.md`, `modes/contacto.md`, and the profile *schema* from
  `config/profile.example.yml` / `modes/_profile.template.md`.
- **Bucket C — source endpoint knowledge** (port into our typed `Source` interface, ADR
  [0003](./0003-normalized-job-model-and-source-interface.md)): the ATS providers we lack —
  `providers/workday.mjs`, `smartrecruiters.mjs`, `recruitee.mjs`, `workable.mjs` (and single-co
  `ibm.mjs`). This is **execution of** the existing tiered strategy in ADR
  [0002](./0002-job-source-access-strategy.md), not a new strategy.
- **Bucket D — explicitly NOT adopted:** `scan.mjs` + most `providers/*` (our typed adapters are
  better, and we already have LinkedIn); the markdown-tracker scripts
  (`merge-tracker`/`dedup-tracker`/`normalize-statuses`/`verify-pipeline`/`reconcile-pipeline`);
  region-specific providers low-value for our US/tech profile (`glints`, `jobstreet`, `solidjobs`,
  `arbeitsagentur`, `workingnomads`) — noted as optional, not planned.

The work is sequenced as milestones [07](../milestones/07-source-layer-expansion.md) (Bucket C),
[08](../milestones/08-scoring-rubric-upgrade.md) (Bucket B, rubric), [09](../milestones/09-application-material-generation.md)
(Buckets A + B, the apply layer), [10](../milestones/10-tracking-and-followup.md) and
[11](../milestones/11-pattern-analysis-and-feedback-loop.md) (Buckets A-logic + B, track/learn).
The file-level mapping lives in [[career-ops-harvest-map]].

## Consequences

**Positive:**
- Closes our two biggest gaps (no CV/material generation; thin scoring + no track/learn loop) with
  battle-tested, permissively-licensed code + prompts instead of greenfield work.
- career-ops's prompts fit our single-task-per-request + llmgw + Zod architecture *better* than they
  fit its own harness — each `mode` becomes one endpoint.
- Keeps our strengths intact: we do not touch ingestion/LinkedIn/UI, which already beat career-ops.

**Negative / trade-offs:**
- Ported `.mjs` becomes our code to type, test, and maintain — no upstream updates flow in (this is
  a one-time harvest, not a vendored dependency).
- We carry career-ops's MIT license obligation (attribution) for copied source.
- The apply layer needs the user's real CV content + profile to be useful — personalization work is
  unavoidable in any system.

**Risks to track:**
- Scope creep: career-ops has far more than we need (batch workers, multi-language modes,
  Canva/LaTeX paths). Stay inside Buckets A–C; resist porting Bucket D.
- The Playwright PDF path adds a heavyweight dep to `apps/api` already used for ingestion — confirm
  one Chromium install serves both.

## Notes

- License: career-ops is MIT; retain attribution on copied source. LinkedIn ToS risk is already
  governed by ADR [0002](./0002-job-source-access-strategy.md) — unchanged here.
- `poc/career-ops/` is a gitignored reference; ports **copy** code into the app tree, never import
  from `poc/` (mirrors the M03 decision to copy POC fixtures rather than depend on `poc/`).
- File-level mapping + per-bucket portability notes: [[career-ops-harvest-map]].
