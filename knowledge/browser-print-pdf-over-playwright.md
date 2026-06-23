---
name: browser-print-pdf-over-playwright
description: Prefer browser print-to-PDF (styled HTML) over a server-side headless browser for document output.
metadata:
  type: feedback
---

For HTML→PDF / printable-document output in this self-hosted, single-user app, prefer **browser
print-to-PDF** — generate ATS-clean, print-styled HTML the user saves via the browser print dialog
(⌘P → Save as PDF) — over adding a server-side headless browser (Playwright/Chromium).

**Why:** M09 decision (ADR [[0005-browser-print-over-playwright]]). There is no existing Chromium to
reuse (LinkedIn and every source use plain `fetch`), so a ~300MB browser dep in `apps/api` is
unjustified for a review-then-download flow, and bloats the k3s image. The pure render path
(`normalizeTextForATS`, `markdownToHtml`, `materialHtml` in `packages/shared/src/materials.ts`) is
unit-testable without a browser, and the user gets true WYSIWYG edit-before-export.

**How to apply:** When a milestone calls for PDF/report output, render styled HTML + let the browser
print it. Only add Playwright if a genuine **server-side artifact** is required (automated emailing,
archival) — and then put it behind the same route as an opt-in, reusing the shared HTML.
