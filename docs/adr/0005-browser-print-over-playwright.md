# 0005 — Browser print-to-PDF over server-side Playwright for materials

- **Status:** accepted
- **Date:** 2026-06-22
- **Deciders:** project founder

## Context

M09 (application material generation) needs to turn a job-tailored CV / cover letter into a
downloadable PDF. ADR [0004](./0004-harvest-career-ops.md) earmarked career-ops's
`generate-pdf.mjs` (Playwright HTML→PDF) as a Bucket-A drop-in, on the assumption — flagged there
as a risk to confirm — that "one Chromium install serves both ingestion and PDF render."

That assumption does not hold: there is **no Chromium/Playwright anywhere in the app today**. The
LinkedIn adapter (and every other source) uses plain `fetch`; the deploy image has no browser. So
porting `renderHtmlToPdf` would introduce a brand-new, ~300MB Chromium + Playwright dependency to
`apps/api` that **nothing else uses**, plus its system-library/font baggage in the k3s image — a
heavyweight addition for a single-user, self-hosted app whose only need is "produce a PDF the user
reviews and downloads."

Forces:
- Single-user, self-hosted, k3s-deployed — image size and operational simplicity matter.
- The product rule is **review/edit → manual submit**; the user is always in the loop at export time.
- The valuable, portable parts of the career-ops materials path are the **ATS-safety text
  normalization** and the **print CSS/templates** — not the browser itself.

## Decision

Render materials as **ATS-clean, print-styled HTML** and let the **browser** produce the PDF (the
user's print dialog → "Save as PDF"). We port career-ops's `normalizeTextForATS` and adapt its
template CSS into print stylesheets (`packages/shared/src/materials.ts`); the LLM emits **markdown**,
which a minimal `markdownToHtml` renders into the styled doc. We do **not** add Playwright/Chromium,
and we do **not** port `buildHtml`/the `{{ }}` template engine (superseded by markdown rendering).

Considered and rejected: server-side Playwright PDF (the milestone-literal path) — full one-click
fidelity, but the heavyweight browser dependency is unjustified here and is exactly the risk ADR 0004
told us to confirm before adopting.

## Consequences

**Positive:**
- Zero new heavy dependencies; the k3s image stays slim.
- True WYSIWYG edit-before-export — the user sees and tweaks the exact content before printing.
- The pure render path (`normalizeTextForATS`, `markdownToHtml`, `materialHtml`) lives in
  `packages/shared` and is fully unit-testable without a browser.

**Negative / trade-offs:**
- PDF is produced client-side, not as a server artifact — no server-stored/emailed PDF, and exact
  pagination depends on the user's browser print engine.
- The markdown render is intentionally minimal (covers the clean markdown the prompts emit), not a
  full CommonMark implementation.

**Risks to track:**
- If a server-generated PDF is later required (e.g. automated emailing), server Playwright can be
  added behind the **same** `POST /jobs/:id/materials` route as an opt-in, reusing the shared HTML —
  a localized follow-up, not a rewrite.

## Notes

- Reframes M09 exit criteria #1/#2 (which named `renderHtmlToPdf` + "one Chromium serves both") to
  "ATS-clean print-styled HTML + browser print-to-PDF." Recorded in the milestone.
- Relates to ADR [0004](./0004-harvest-career-ops.md) (the harvest that proposed the Playwright path).
