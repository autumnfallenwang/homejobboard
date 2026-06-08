---
name: antibot-blocked-boards
description: Which boards are walled/gated/dropped and why — so we don't re-research them every cycle
metadata:
  type: reference
---

Settled facts from the 2026-06-08 research round about boards we are **not** building at MVP. Recorded
so we don't re-investigate them each cycle. Decision context: ADR [[0002-job-source-access-strategy]].

**Deferred (high weight, but no free path):**
- **Indeed** (~11%) — legacy Publisher API retired; site Cloudflare-walled (403 on plain fetch). No
  free direct access.
- **Wellfound** (~8%) — AngelList jobs API gone after the rebrand; site DataDome-walled. No free direct
  access. Only paid Apify actors.
- Both *might* be reachable via a paid aggregator (JSearch) that claims coverage — **unverified**. The
  only cheap test is a free JSearch key; until then, assume the gap is open.

**Dropped (not worth the effort for tech/US/free-first):**
- **Glassdoor** — Cloudflare 403; Jobs API partner-gated (docs themselves 403).
- **ZipRecruiter** — partner-approval key; the partner endpoint is a posting API, not a seeker search.
- **Dice** — public search API retired (`service.dice.com/api/...` 404/410); only HTML scrape remains.
- **Google for Jobs** — no read API at all; only paid SERP scrapers (SerpApi). The Indexing API is for
  *your own* URLs, not reading others'.
- **niche crypto/VC boards** (web3.career, etc.) — token-gated APIs.
- **YC "Work at a Startup"** — no public posted-date field, ~28-job public cap, real search needs login.

**Why this matters:** the official LinkedIn/Indeed/Glassdoor/ZipRecruiter developer APIs are all
**partner-gated and unavailable to a personal project** — re-checking them is wasted effort. If the
landscape changes (a board opens a free API, or we accept paid), reopen ADR 0002 rather than
re-running the whole research. Per-source access for what we *did* select: [[job-source-access-catalog]].
