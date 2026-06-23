---
name: ats-company-slug-sourcing
description: ATS sources (Greenhouse/Lever/Ashby) are per-company with no enumerate-all endpoint — we must seed a company-token list
metadata:
  type: project
---

The ATS adapters (Greenhouse, Lever, Ashby) are the cleanest free sources — zero-auth, full
descriptions, real post timestamps — **but each call is scoped to one company** (a board token/slug,
e.g. `greenhouse:stripe`, `lever:netflix`, `ashby:{name}`). Confirmed in the 2026-06-08 research:
**there is no public endpoint to list all companies on an ATS.** Coverage = however many company
tokens we feed in.

**Why:** ATS boards exist to power each employer's own careers page, not to be a cross-company search.
So the value of [[job-source-access-catalog]]'s Tier-1 ATS sources is bounded entirely by our
company-token list — an external data-sourcing task, not an access problem.

**How to apply:**
- Store company tokens as `sources` rows (one per company per ATS) — built in milestone
  `03-source-adapters-and-ingestion`.
- ~~Seed an initial curated list~~ — done (05b, 2026-06-10): 11 boards seeded in
  `apps/api/src/db/seed.ts` (5 Greenhouse, 3 Lever, 3 Ashby), every token live-validated that day.
  A stale token fails soft: the poll isolates per-source errors and just logs (e.g. `lever:plaid`
  was dead on arrival and got swapped for `palantir`/`zoox`).
- Grow it via the **settings-UI add-board form** (POST `/sources`, kind + company token). Possible
  later feeders: discover tokens from jobs already found via LinkedIn/other sources (their apply
  URLs often point at `*.greenhouse.io` / `lever.co` / `ashbyhq.com`), or curated public lists of
  companies-by-ATS.
- The feed adapters (RemoteOK/Remotive/WWR/HN) are **not** blocked by this — they poll whole boards.
