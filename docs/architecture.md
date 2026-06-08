# Architecture

homejobboard is a single-user, self-hosted job-aggregation web app. It exists to run a set of pre-defined filters across the major job boards, surface newly-listed jobs in one place, score each for personal fitness with an LLM, and rank them — so the owner can quickly review or apply without checking each board by hand.

## System shape

A **Hono + Zod API** (`apps/api`, port 3001) runs scheduled scrapers/fetchers against the major job boards using the pre-defined filter set, normalizes the results into a common listing shape, and persists them to **PostgreSQL via Drizzle**. Newly-listed jobs are scored for fitness by an **LLM** — reached through the home cluster's `llmgw` gateway — and ranked. A **Next.js App Router frontend** (`apps/web`, port 3000) reads from the API and presents the freshly-listed, ranked jobs for reference, with a quick path to send out applications.

The web app talks to the API over HTTP; the API owns all scraping, scoring, and persistence. Shared Zod schemas and types live in `packages/shared` and define the boundary contract between the two. The whole stack deploys to the home **k3s** cluster via a Helm chart (`deploy/chart`) under Argo CD GitOps, mirroring the sibling `homenews` / `homework` / `homecal` repos. Concrete job-board targets and the application "send out" mechanism are deferred to a later POC.

## Key components

- **`apps/api`** — Hono + Zod backend (port 3001): job-board scrapers/fetchers, the pre-defined filter set, listing normalization, LLM fitness scoring via `llmgw`, and Drizzle/PostgreSQL data access.
- **`apps/web`** — Next.js App Router frontend (port 3000): displays the freshly-listed, fitness-ranked jobs and provides a quick path to send out applications.
- **`packages/shared`** — shared Zod schemas and TypeScript types forming the API↔web contract.
- **`deploy/chart`** — Helm chart for the home k3s cluster (Argo CD GitOps).

## Constraints and non-goals

**Constraints:**

- **Single-user.** Built for one person; no concept of multiple users or accounts.
- **Self-hosted only.** Runs on the home k3s cluster; not a public/SaaS deployment.

**Non-goals:**

- **No multi-tenancy.**
- **No authentication / authorization layer.**
- Concrete job-board integrations and the application "send out" mechanism are intentionally out of scope for now — deferred to a later POC.

## Open questions

- Which job boards to target first, and via API vs. HTML scraping per board.
- The exact shape of the pre-defined filter set.
- How the LLM fitness score is computed (prompt, inputs, scale) and which model via `llmgw`.
- The application "send out" mechanism — what "quick way to send out" concretely means.

These are expected to be resolved during the upcoming POC.
