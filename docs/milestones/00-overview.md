---
name: 00-overview
status: reference
created: 2026-06-08
---

# Build overview — homejobboard

Roadmap index for building **homejobboard**: a single-user, self-hosted job-aggregation web app
that pulls just-listed jobs from selected sources, LLM-scores each for personal fitness, and ranks
them. Mirrors the sibling `homenews` / `homework` / `homecal` Turborepo stack.

The *what* and *why* of sources and the data model are settled (see ADRs below); these milestones
are the *how*. Work them in order — each depends on the prior. Run one at a time via `/devkit-task`.

| # | Milestone | What ships | Depends on |
|---|-----------|-----------|------------|
| 01 | [Monorepo bootstrap](01-monorepo-bootstrap.md) | Turborepo skeleton (api/web/shared), dev loop, `/health` | — |
| 02 | [Data model & shared schema](02-data-model-and-shared-schema.md) | Drizzle tables + the `Job`/`JobFilters`/`Source` Zod contract | 01 |
| 03 | [Source adapters & ingestion](03-source-adapters-and-ingestion.md) | `Source` interface + Tier-1 adapters + normalize→dedup→store + poll scheduler | 02 |
| 04 | [LLM fitness scoring & ranking](04-llm-fitness-scoring-and-ranking.md) | `llmgw` client, fitness score on new jobs, composite rank | 03 |
| 05 | [Web frontend](05-web-frontend.md) | Ranked-job views, filter config, detail, quick send-out | 02, 04 |
| 05b | [Product polish](05b-product-polish.md) | Filters wired into ingestion, Ashby + HN adapters, seed expansion, UI redesign | 05 |
| 06 | [Deploy & GitOps](06-deploy-gitops.md) | Dockerfiles, Helm chart, CI, arch-infra registration | 01–05b |

### Post-MVP — harvest career-ops (ADR [0004](../adr/0004-harvest-career-ops.md))

Adopt the MIT-licensed career-ops system (vendored at `poc/career-ops/`) as a **parts donor** for the
apply / track / learn halves the MVP lacks. homejobboard stays the spine; career-ops supplies the
intelligence. File-level map: `knowledge/career-ops-harvest-map.md`.

| # | Milestone | What ships | Depends on |
|---|-----------|-----------|------------|
| 07 | [Source-layer expansion](07-source-layer-expansion.md) | Workday/SmartRecruiters/Recruitee/Workable adapters + Tier-2/3 finishers; ported liveness + role-match dedup | 03 |
| 08 | [Scoring rubric upgrade](08-scoring-rubric-upgrade.md) | A–G structured `FitnessVerdict` (explainable scoring) via one llmgw call | 04 |
| 09 | [Application material generation](09-application-material-generation.md) | Tailored CV→ATS PDF + cover letter, on-demand, never auto-submitted | 04, 05 |
| 10 | [Tracking + follow-up](10-tracking-and-followup.md) | Canonical status state-machine + follow-up cadence/drafting | 05 |
| 11 | [Pattern analysis + feedback loop](11-pattern-analysis-and-feedback-loop.md) | Outcome insights that suggest filter/profile edits — closes the 4→1 loop | 08, 10 |

## Cross-cutting decisions (locked)

- **Stack:** Turborepo + pnpm · Hono + Zod · Next.js App Router · Postgres + Drizzle · Vitest + Biome
  (follows `homenews`/`homework`/`homecal` exactly). See ADR [0001](../adr/0001-initial-stack.md).
- **Source strategy:** free-first, tiered source layer. Build Tier-1 (ATS + clean feeds) first;
  LinkedIn guest + free-key aggregators next; Indeed/Wellfound deferred; Glassdoor/ZipRecruiter dropped.
  ADR [0002](../adr/0002-job-source-access-strategy.md).
- **Data model:** one normalized `Job`, a two-stage `Source` adapter interface; just-listed = poll+diff;
  dedup across sources; scoring decoupled (new jobs only). ADR [0003](../adr/0003-normalized-job-model-and-source-interface.md).
- **No auth, single-user, self-hosted** — no Better Auth / multi-tenancy.
- **LLM:** cluster `llmgw` gateway (reused via ingress, mirroring homenews) — no separate dev gateway.

## Standing open questions (need input before the relevant milestone)

1. ~~**`JobFilters` shape**~~ — resolved (05b): keywords / excludeKeywords / location /
   workplaceType / postedSince, stored as the `job_filters` setting, editable in the settings UI.
2. ~~**ATS company list**~~ — resolved (05b): curated 11-board starter list seeded (all tokens
   live-validated); grows via the settings-UI add-board form. See
   `knowledge/ats-company-slug-sourcing.md`.
3. **Free keys** (M03) — provide free **Adzuna** + **JSearch** keys to validate Tier-2 + test the
   Indeed/Wellfound gap. *(non-blocking; ATS/feeds work without them)*
4. **Fitness prompt & model** (M04) — resolved baseline: claude-haiku-4-5 via llmgw, profile in the
   `fitness_profile` setting. The user should keep refining the profile text.
5. **"Send out"** (M05) — resolved baseline: open `applyUrl` + track applied/dismissed.
   Drafting/automation still open if ever wanted.

## How to work a milestone

Run `/devkit-task` — it reads `CLAUDE.md`, `docs/architecture.md`, and the highest-numbered open
milestone, then plans → gates → implements → verifies. Ship with `/devkit-commit`.
`devkit-update-milestone` appends progress notes and closes a milestone when its exit criteria are met.
