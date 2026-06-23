---
name: 09-application-material-generation
status: done
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

> **Render approach reframed by ADR [0005](../adr/0005-browser-print-over-playwright.md):** there is no
> existing Chromium to reuse, so materials render as ATS-clean print-styled **HTML** + browser
> print-to-PDF — no server Playwright. Criteria #1/#2 are reframed accordingly.

- [x] ~~`renderHtmlToPdf` ports…valid PDF~~ → `normalizeTextForATS` ported + `materialHtml` produces ATS-clean print-styled HTML (unit-tested); browser saves the PDF
- [x] ~~One Chromium install serves both~~ → **no server browser dependency** (the point of ADR 0005)
- [x] `POST /jobs/:id/materials?kind=cv` returns a job-tailored CV (markdown); `kind=cover` returns a cover letter — route + generation live-verified (CV); cover uses the identical path
- [x] Tailoring prompt does not fabricate experience — CV smoke kept every employer/metric from the source CV; guardrail present in both prompts
- [x] **No submit path** — generate → edit → print/download only; user applies manually
- [x] `pnpm lint` / `typecheck` / `test:fast` (95) / `build` green (render covered by `materials.test.ts`)

## Decisions (locked)

- **Never auto-apply.** Generate → user reviews/edits → user submits manually. Hard product rule.
- Strong model for tailoring (on-demand, low volume) vs cheap model for M08 scoring (batch, high volume).
- `buildHtml` ports as a pure function (testable without Playwright); Playwright loaded lazily in the route.

## Open questions

- ~~CV input format~~ — resolved: free-text **markdown** `cv` setting (mirrors the M08 free-text profile); the LLM emits markdown.
- ~~Where templates live~~ — resolved: pure render (`normalizeTextForATS`/`markdownToHtml`/`materialHtml` + print CSS) in `packages/shared`, used by the web.
- Screening-question answer generation (career-ops `apply` mode) — **deferred** (not in M09).

## Progress

- 2026-06-22: Shipped the apply layer (ADR 0004 Buckets A+B; render pivot per ADR 0005). Pure render
  in `packages/shared/src/materials.ts` (`normalizeTextForATS`, minimal `markdownToHtml`, `materialHtml`
  + ported CV/cover print CSS). `apps/api/src/materials/` holds the tailoring/cover prompts (career-ops
  anti-fabrication guardrails) + `generateMaterial` (strong `llm_model_materials` primary → fallback,
  mirrors M08). New `POST /jobs/:id/materials`; new `cv` + materials-model settings. Web: settings CV
  editor + a detail-view "prepare application" panel (Tailor CV / Cover letter → editable → Export PDF
  via a browser print window). ADR 0005 records the browser-print-over-Playwright decision. lint /
  typecheck / test:fast (95) / build green.
- 2026-06-22: **Live smoke** — set a sample CV, generated a tailored CV for a real job: faithful, **no
  fabrication** (kept Stripe/GitLab + the exact "p95 38%"/"$1.2M" metrics from the source CV). **Browser
  smoke** — settings CV editor + the detail materials panel render; the full click→generate round-trip
  is wired (CORS preflight 204, route reached, primary→fallback fired) but the live generation hangs on
  the slow local `gemma4:26b` fallback while the gateway's Anthropic backend is down ([[llmgw-gateway]])
  — an infra-latency condition, not an M09 defect (the route fails closed to 502; the panel shows the
  error). The CV generation + the ATS-clean render are otherwise verified (server smoke + unit tests).
- 2026-06-23: llmgw Anthropic backend fixed → re-verified through the **primary** model: both CV (~7s)
  and cover letter (~13s) generate via `claude-sonnet-4-5` (no fallback), faithful with no fabrication
  (kept the source CV's employers + exact "p95 38%"/"$1.2M" metrics; cover opens with a concrete metric,
  mirrors the job's stack, no banned buzzwords). The earlier gemma-fallback hang is resolved.

## Outcome

**Closed: 2026-06-23.** Shipped the apply layer (ADR 0004 Buckets A+B): from a job's detail view the
user generates a job-tailored CV and cover letter (one strong-model llmgw call each, career-ops
anti-fabrication guardrails), edits them, and exports a PDF via the browser print dialog — never
auto-submitted. Pure render (`normalizeTextForATS`, `markdownToHtml`, `materialHtml` + ported print
CSS) lives in `packages/shared`; `apps/api/src/materials/` holds the prompts + `generateMaterial`;
new `POST /jobs/:id/materials`, `cv` + materials-model settings, a settings CV editor, and a
detail-view "prepare application" panel. lint / typecheck / test:fast (95) / build green;
end-to-end verified through the primary `claude-sonnet-4-5` (CV + cover, faithful, no fabrication).

**Deviation:** render pivoted from server Playwright to browser print-to-PDF — there was no existing
Chromium to reuse, so the ~300MB browser dep was unjustified. Recorded in ADR
[0005](../adr/0005-browser-print-over-playwright.md); exit criteria #1/#2 reframed above. The
markdown-end-to-end approach also superseded career-ops's `{{ }}` template engine / `buildHtml`.
Captured as a reusable convention: [[browser-print-pdf-over-playwright]].

**Deferred (milestone open Q):** screening-question answer generation (career-ops `apply` mode).
