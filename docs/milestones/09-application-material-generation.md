---
name: 09-application-material-generation
status: proposed
created: 2026-06-22
---

# Milestone 09 — Application material generation (CV + cover letter)

Build the *apply* half the MVP lacks: on-demand, per-job generation of a tailored, ATS-clean CV PDF
and a cover letter — the single biggest gap (today's "send out" is just `open applyUrl`). Realizes
ADR [0004](../adr/0004-harvest-career-ops.md) Buckets A (code) + B (prompts). Mapping:
[[career-ops-harvest-map]].

## Goal

From a job's detail view, the user clicks "prepare application" and gets (a) a CV tailored to that
job, rendered to an ATS-parseable PDF, and (b) a cover letter — both reviewable/editable, **never
auto-submitted**. The deterministic render path is ported wholesale; the "what to write" is one
llmgw call per artifact.

## Why (flow step 3b)

This stage is on-demand and selective (the 3–5 jobs the user actually wants), so it can use a
stronger model and do real per-job tailoring — the opposite cost profile from M08's batch scoring.
career-ops owns this capability; most of it is droppable code + prompts.

## Scope / deliverables

- **PDF render (Bucket A drop-in — the centerpiece):** port `poc/career-ops/generate-pdf.mjs`
  (Playwright HTML→PDF + `normalizeTextForATS` Unicode safety) → `apps/api/src/materials/render-pdf.ts`,
  exposing `renderHtmlToPdf(html, {format})`. Reuse the **same Chromium** the ingestion/LinkedIn path
  already installs (confirm one install serves both — see ADR 0004 risk).
- **CV template (Bucket A):** copy `poc/career-ops/templates/cv-template.html` into
  `apps/api/src/materials/templates/` (or serve via `apps/web`); parameterize with the user's CV data.
- **CV source of truth:** a `cv` setting (structured CV content, markdown or JSON) the user edits in
  settings — the canonical input both the tailoring prompt and the template read. Mirrors career-ops's
  `cv.md` role without its file convention.
- **Tailoring prompt (Bucket B):** one llmgw call `(cv, job, fitnessProfile) → tailored CV content`
  (emphasis/reordering for this job; **no fabrication** — guardrail in the prompt). Then template +
  `renderHtmlToPdf` → PDF.
- **Cover letter (Buckets A + B):** port `poc/career-ops/generate-cover-letter.mjs` (`buildHtml` is
  already a pure fn) + `templates/cover-letter-template.html`; the letter *text* is one llmgw call
  adapted from `poc/career-ops/modes/cover.md` → JSON payload → `buildHtml` → `renderHtmlToPdf`.
- **API + web:** `POST /jobs/:id/materials` (kind = cv | cover) returns the artifact; detail view gets
  a "prepare application" panel showing generated CV/cover with download + an edit-before-export path.
- *(optional, deferred)* LaTeX CV export via `poc/career-ops/generate-latex.mjs` — only if wanted;
  needs `pdflatex`. Out of scope unless requested.

## Exit criteria

- [ ] `renderHtmlToPdf` ports with ATS Unicode normalization; produces a valid PDF from the CV template
- [ ] One Chromium install serves both ingestion and PDF render (no second browser dep)
- [ ] `POST /jobs/:id/materials?kind=cv` returns a job-tailored CV PDF; `kind=cover` returns a cover letter
- [ ] Tailoring prompt does not fabricate experience (review a sample; guardrail present)
- [ ] **No submit path** — generation + download/edit only; user applies manually (ADR 0004 / project ethic)
- [ ] `pnpm lint` / `typecheck` / `test:fast` / `build` green (PDF render covered by at least a smoke test)

## Decisions (locked)

- **Never auto-apply.** Generate → user reviews/edits → user submits manually. Hard product rule.
- Strong model for tailoring (on-demand, low volume) vs cheap model for M08 scoring (batch, high volume).
- `buildHtml` ports as a pure function (testable without Playwright); Playwright loaded lazily in the route.

## Open questions

- CV input format for the `cv` setting (structured JSON vs markdown) — drives both prompt + template.
- Where templates live (api vs web) and whether the user can pick/customize a template.
- Screening-question answer generation (career-ops `apply` mode) — include here or a later milestone?
