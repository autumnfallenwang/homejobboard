---
name: project-profile
description: Seeded by /devkit-init on 2026-06-08. Captures who this project is and what shape it has.
metadata:
  type: project
---

# homejobboard

A single-user job-aggregation web app that runs pre-defined filters across the major job boards, LLM-scores newly-listed jobs for fitness, and ranks them for quick reference and applying.

## What this project is

The owner currently has to check several job boards by hand to find newly-listed roles worth applying to. homejobboard solves that by running a set of pre-defined filters across the major boards on a schedule, normalizing the listings, LLM-scoring each new job for personal fitness, and ranking them. The sole consumer is the owner, via a Next.js web UI that shows the ranked jobs for reference and offers a quick path to apply. The defining constraints: single-user and self-hosted only, with no multi-tenancy and no auth. Concrete board integrations and the "send out" mechanism are deferred to a later POC.

## Stack at a glance

- **Primary language:** typescript
- **Package manager:** pnpm

- **Monorepo:** Turborepo + pnpm workspaces
- **Backend:** Hono + Zod (`apps/api`, port 3001)
- **Frontend:** Next.js App Router (`apps/web`, port 3000)
- **Shared types:** `packages/shared` (Zod)
- **Database:** PostgreSQL via Drizzle
- **LLM:** home cluster `llmgw` gateway (fitness scoring)
- **Lint/format:** Biome
- **Tests:** Vitest
- **Typecheck:** `tsc --noEmit`
- **Deploy:** Helm chart on home k3s cluster via Argo CD GitOps

## Why future-you should keep this entry up to date

This is `type: project`, meaning it's a live cache of project-level context — not history. As the project evolves (new components, removed deps, shifted scope), update this file. Delete it entirely if the project changes shape so fundamentally that the brainstorm answers no longer apply, and capture a fresh one.
