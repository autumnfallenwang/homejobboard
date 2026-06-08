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
- Seed an initial curated list (target companies the user cares about) — **standing open question #2,
  blocking for the ATS adapters**.
- Grow it over time. Possible feeders to consider later: discover tokens from jobs already found via
  LinkedIn/other sources (their apply URLs often point at `*.greenhouse.io` / `lever.co` / `ashbyhq.com`),
  or curated public lists of companies-by-ATS.
- The feed adapters (RemoteOK/Remotive/WWR/HN) are **not** blocked by this — build them in parallel.
