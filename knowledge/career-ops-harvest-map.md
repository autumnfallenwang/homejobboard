---
name: career-ops-harvest-map
description: Which career-ops file/prompt maps to which homejobboard target — the M07–M11 harvest (ADR 0004).
metadata:
  type: reference
---

career-ops (MIT, `https://github.com/santifer/career-ops`) is vendored at `poc/career-ops/`
(gitignored, reference only). We adopt it as a **parts donor** for the apply/track/scoring layers —
decision + rationale in ADR [[0004-harvest-career-ops]]. `poc/` can't be imported at runtime, so
every port **copies code into the app tree** (`.mjs`→`.ts`) or adopts a prompt as a
template + Zod schema. This file is the durable file-level map so it isn't buried in milestones.

## Bucket A — drop-in code (copy + port `.mjs`→`.ts`)

| career-ops file | What it is | homejobboard target | Milestone |
|---|---|---|---|
| `poc/career-ops/generate-pdf.mjs` | Playwright HTML→PDF + `normalizeTextForATS` (Unicode/ATS safety). Exports `renderHtmlToPdf`. | `apps/api/src/materials/render-pdf.ts` | 09 |
| `poc/career-ops/templates/cv-template.html` | CV HTML/CSS template | `apps/api/src/materials/templates/` | 09 |
| `poc/career-ops/generate-cover-letter.mjs` | `buildHtml` (pure fn) + render via the PDF pipeline | cover-letter render path | 09 |
| `poc/career-ops/templates/cover-letter-template.html` | cover-letter template | materials templates | 09 |
| `poc/career-ops/liveness-core.mjs` | pure regex classifier: expired / live / uncertain (+ anti-bot interstitial guard) | `apps/api/src/sources/liveness.ts` | 07 |
| `poc/career-ops/role-matcher.mjs` | pure fuzzy same-opening matcher (`ROLE_STOPWORDS`, `SHORT_SPECIALTY`) | `apps/api/src/services/role-match.ts` (into `dedup.ts`) | 07 |
| `poc/career-ops/followup-cadence.mjs` | **logic only** (`DEFAULT_CADENCE` + due-date math); its `applications.md` parsing is dropped | `apps/api/src/tracking/cadence.ts` (fed DB rows) | 10 |
| `poc/career-ops/analyze-patterns.mjs` | **logic only** (dimension extraction + classification, see `MACHINE_SUMMARY_FIELDS`); file I/O dropped | `apps/api/src/insights/patterns.ts` (fed DB rows) | 11 |

## Bucket B — prompt artifacts (adopt as prompt template + Zod schema, one llmgw call each)

| career-ops file | What it is | homejobboard target | Milestone |
|---|---|---|---|
| `poc/career-ops/modes/oferta.md` | A–G evaluation rubric + `## Machine Summary` structured fields | scoring prompt + `FitnessVerdict` Zod schema | 08 |
| `poc/career-ops/config/profile.example.yml`, `modes/_profile.template.md` | profile *schema* (strengths, archetypes, dealbreakers, comp) | widen the `fitness_profile` setting | 08 |
| `poc/career-ops/modes/cover.md` | cover-letter writing prompt | cover-letter text call | 09 |
| `poc/career-ops/modes/interview-prep.md` | interview-prep prompt | (optional in 09 / later) | 09 |
| `poc/career-ops/modes/contacto.md` | LinkedIn outreach prompt | (optional) | — |
| `poc/career-ops/templates/states.yml` | canonical application states | tracking state-machine (Zod enum + transitions) | 10 |

## Bucket C — source endpoint knowledge (port into the typed `Source` interface, ADR [[0003-normalized-job-model-and-source-interface]])

ATS adapters we lack — port endpoint + parsing from `poc/career-ops/providers/`:

| career-ops provider | homejobboard adapter | Note |
|---|---|---|
| `workday.mjs` | `apps/api/src/sources/workday.ts` | POST CXS, paginated, tenant auto-detect — **biggest enterprise gap** |
| `smartrecruiters.mjs` | `smartrecruiters.ts` | public postings API |
| `recruitee.mjs` | `recruitee.ts` | per-tenant offers API; SSRF-safe slug regex |
| `workable.mjs` | `workable.ts` | no-auth markdown feed |
| `ibm.mjs` | `ibm.ts` (optional) | single-company |

## Bucket D — NOT adopted

- `scan.mjs` + most `providers/*` — our typed adapters are better; we already have a LinkedIn adapter.
- `merge-tracker.mjs`, `dedup-tracker.mjs`, `normalize-statuses.mjs`, `verify-pipeline.mjs`,
  `reconcile-pipeline.mjs` — they exist to manage a **markdown-table tracker**; we have Postgres.
- Region-specific providers (`glints`, `jobstreet`, `solidjobs`, `arbeitsagentur`, `workingnomads`)
  — low value for the US/tech profile (ADR [[0002-job-source-access-strategy]]); revisit only if targeting shifts.

## Cross-cutting

- **Spine vs brain:** homejobboard stays the spine (always-on app, DB, ingestion incl. LinkedIn, UI);
  career-ops is the brain for apply (09) + track/learn (10–11) + the scoring rubric (08).
- **License:** MIT — retain attribution on copied source.
- **No auto-submit:** all generated materials + follow-ups are review-then-send-manually.
