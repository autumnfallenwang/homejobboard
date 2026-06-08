# Architecture

homejobboard is a single-user, self-hosted job-aggregation web app. It exists to run a set of pre-defined filters across the major job boards, surface newly-listed jobs in one place, score each for personal fitness with an LLM, and rank them — so the owner can quickly review or apply without checking each board by hand.

## System shape

A **Hono + Zod API** (`apps/api`, port 3001) runs scheduled scrapers/fetchers against the major job boards using the pre-defined filter set, normalizes the results into a common listing shape, and persists them to **PostgreSQL via Drizzle**. Newly-listed jobs are scored for fitness by an **LLM** — reached through the home cluster's `llmgw` gateway — and ranked. A **Next.js App Router frontend** (`apps/web`, port 3000) reads from the API and presents the freshly-listed, ranked jobs for reference, with a quick path to send out applications.

The web app talks to the API over HTTP; the API owns all fetching, scoring, and persistence. Shared Zod schemas and types live in `packages/shared` and define the boundary contract between the two. The whole stack deploys to the home **k3s** cluster via a Helm chart (`deploy/chart`) under Argo CD GitOps, mirroring the sibling `homenews` / `homework` / `homecal` repos.

## Ingestion pipeline & source layer

The API ingests jobs through a **common source-adapter layer**, so the heterogeneity of boards
(ATS JSON, clean feed APIs, free-key aggregators, HTML guest scrapes) never leaks into the rest
of the system. Each adapter implements a two-stage `Source` interface — `search(filters)` →
list, `fetchDetail(summary)` → full description (a no-op for sources that already return it).
See ADR [0003](adr/0003-normalized-job-model-and-source-interface.md).

```
JobFilters ─▶ [Source adapters]  ─▶ normalize ─▶ dedup ─▶ store (Postgres)
              Greenhouse/Lever/Ashby (ATS)              │  new+filter-passing only
              RemoteOK/Remotive/WWR/HN (clean feeds)    ▼
              Adzuna/USAJobs (free key)            LLM fitness score (llmgw)
              LinkedIn guest, BuiltIn, Otta (web)       │
                                                        ▼
                                              composite rank ─▶ apps/web
```

- **Selected sources & access tiers:** ADR [0002](adr/0002-job-source-access-strategy.md); per-source
  endpoints/fields in `knowledge/job-source-access-catalog.md`.
- **"Just-listed" = poll + diff** on each job's original-post timestamp (no source offers a true
  server-side cursor); a scheduler polls enabled sources on an interval.
- **Dedup** collapses the same job seen on multiple sources via a normalized `company+title+location` key.
- **Scoring is decoupled:** only new, deduped, filter-passing jobs are sent to the LLM — never the whole pull.

## Key components

- **`apps/api`** — Hono + Zod backend (port 3001): the **source-adapter layer**, the filter set,
  listing normalization + dedup, the poll scheduler, LLM fitness scoring via `llmgw`, and
  Drizzle/PostgreSQL data access.
- **`apps/web`** — Next.js App Router frontend (port 3000): displays the freshly-listed, fitness-ranked jobs and provides a quick path to send out applications.
- **`packages/shared`** — shared Zod schemas and TypeScript types: the normalized `Job` model,
  `JobFilters`, and the `Source` interface — the API↔web contract.
- **`deploy/chart`** — Helm chart for the home k3s cluster (Argo CD GitOps).

## Constraints and non-goals

**Constraints:**

- **Single-user.** Built for one person; no concept of multiple users or accounts.
- **Self-hosted only.** Runs on the home k3s cluster; not a public/SaaS deployment.

**Non-goals:**

- **No multi-tenancy.**
- **No authentication / authorization layer.**
- **No Indeed / Wellfound / Glassdoor / ZipRecruiter at MVP** — anti-bot-walled or partner-gated; deferred or dropped (ADR [0002](adr/0002-job-source-access-strategy.md)).

## Resolved by the 2026-06-08 research round

- **Which boards & how to access them** → ADR [0002](adr/0002-job-source-access-strategy.md) + `knowledge/job-source-access-catalog.md`.
- **Common model & per-board API-vs-scrape** → ADR [0003](adr/0003-normalized-job-model-and-source-interface.md).

## Open questions

- The exact shape of the pre-defined `JobFilters` set (keywords, location, level, postedSince).
- The LLM fitness prompt, inputs, scale, and which `llmgw` model (milestone 04).
- The application "send out" mechanism — what "quick way to send out" concretely means.
- **ATS company-list sourcing** — how to seed/grow the Greenhouse/Lever/Ashby company tokens
  (`knowledge/ats-company-slug-sourcing.md`).
- Whether a free **Adzuna** / **JSearch** key closes any of the Indeed/Wellfound gap (cheap to test).
