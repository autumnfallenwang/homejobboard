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
| 06 | [Deploy & GitOps](06-deploy-gitops.md) | Dockerfiles, Helm chart, CI, arch-infra registration | 01–05 |

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

1. **`JobFilters` shape** (M03/M05) — exact filter fields the user wants (keywords sets, locations,
   levels, postedSince window).
2. **ATS company list** (M03) — how to seed the Greenhouse/Lever/Ashby company tokens; see
   `knowledge/ats-company-slug-sourcing.md`. *(blocking for ATS adapters)*
3. **Free keys** (M03) — provide free **Adzuna** + **JSearch** keys to validate Tier-2 + test the
   Indeed/Wellfound gap. *(non-blocking; ATS/feeds work without them)*
4. **Fitness prompt & model** (M04) — what makes a job a good fit (the user's profile/criteria), and
   which `llmgw` model.
5. **"Send out"** (M05) — what the quick-apply action concretely does (open apply URL / draft / track).

## How to work a milestone

Run `/devkit-task` — it reads `CLAUDE.md`, `docs/architecture.md`, and the highest-numbered open
milestone, then plans → gates → implements → verifies. Ship with `/devkit-commit`.
`devkit-update-milestone` appends progress notes and closes a milestone when its exit criteria are met.
