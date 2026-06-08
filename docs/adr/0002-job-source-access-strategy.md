# 0002 — Job-source access strategy

- **Status:** accepted
- **Date:** 2026-06-08
- **Deciders:** project founder (decided from the 2026-06-08 facts-only research round)

## Context

homejobboard ingests "just-listed" jobs from many boards. We ran a facts-only, multi-agent
research round (one agent per board, with live validation scripts) over 20 boards/clusters,
weighted for a **pure-tech / software, US-primary, single-user** profile, **free-first**
(paid 3rd-party researched only for Tier-A boards with no free path). The raw corpus lived in
`poc/` (gitignored); this ADR is the durable conclusion. The per-source access facts are
preserved in [[job-source-access-catalog]].

Key findings that shaped the decision:

- **15 of 20 boards have a free, live-validated access path.** 5 do not: Indeed, Wellfound,
  Glassdoor, ZipRecruiter, Adzuna (last is only key-blocked, not walled).
- **ATS endpoints are the cleanest win:** Greenhouse / Lever / Ashby expose public, zero-auth,
  versioned JSON with **full descriptions** and a true original-post timestamp
  (`first_published` / `createdAt` / `publishedAt`) — but **per-company**, with no way to
  enumerate company tokens (see [[ats-company-slug-sourcing]]).
- **LinkedIn** (weight 25%) is reachable free via its unauthenticated `jobs-guest` endpoints
  (list + detail), with `f_TPR` giving exact "just-listed" filtering — but it's undocumented
  HTML (parser upkeep) and ToS-gray.
- **Indeed & Wellfound** (combined 19% weight) are anti-bot-walled (Cloudflare / DataDome) with
  no free direct path; their legacy APIs are retired. Only paid aggregators (JSearch, Apify)
  remain, and their actual coverage/freshness is **unvalidated** (needs a key).
- **Glassdoor, ZipRecruiter** are partner-gated and/or hard-walled with low tech weight.
- The official LinkedIn / Indeed / Glassdoor / ZipRecruiter developer APIs are **partner-gated
  and unavailable** to a personal project. See [[antibot-blocked-boards]].

## Decision

Build a **free-first, tiered source layer**, selecting sources by access quality, not just
board prestige. Concretely:

**Tier 1 — clean, zero-auth, full-data (build first):**
- **ATS direct:** Greenhouse, Lever, Ashby (per curated company list — see [[ats-company-slug-sourcing]]).
- **Clean job APIs/feeds:** RemoteOK (`/api`), Remotive (`/api/remote-jobs`), We Work Remotely (RSS),
  Hacker News "Who is Hiring" (Algolia/Firebase API).

**Tier 2 — free, needs a free key (validate key at build time):**
- **Adzuna** (`api.adzuna.com`, `sort_by=date` + `max_days_old`) and **USAJobs** (`data.usajobs.gov`,
  `DatePosted`). Both have real just-listed support; both were `blocked(needs_key)` in research.

**Tier 3 — free public-web / guest scrape (accept maintenance + ToS-gray):**
- **LinkedIn guest** (`jobs-guest` list + detail, `f_TPR` just-listed) — kept for breadth despite
  upkeep. Polite, low volume.
- **BuiltIn** (`?daysSinceUpdated=1`) and **Otta / Welcome to the Jungle** (per-job GraphQL) — optional,
  validated, add when convenient.

**Deferred (revisit only via one paid-aggregator trial):**
- **Indeed, Wellfound.** Not in the MVP. Reassess by trialing a single paid aggregator (JSearch) that
  *advertises* covering both — but only after confirming its real coverage/freshness with a key.

**Dropped (not worth the effort for this profile):**
- **Glassdoor, ZipRecruiter, Dice (retired API), Google-for-Jobs (no read API), niche crypto/VC boards
  (token-gated), YC "Work at a Startup" (no public posted-date field).** See [[antibot-blocked-boards]].

**Cross-cutting:** every source is reached through one common adapter interface (ADR
[0003](./0003-normalized-job-model-and-source-interface.md)), so the tier of a source never leaks
into the rest of the pipeline.

## Consequences

**Positive:**
- MVP covers the bulk of the tech job landscape **for free, with proven access** — no paid
  dependency to ship.
- ATS + clean feeds give **full descriptions in one call** (no fragile Stage-2 scrape) for most volume.
- LinkedIn breadth is retained without paying.
- The deferred/dropped calls are explicit, so we don't re-litigate Indeed/Glassdoor every sprint.

**Negative / trade-offs:**
- **No Indeed/Wellfound at MVP** — a real coverage gap (19% weight) accepted in exchange for
  free-and-now. Mitigated by LinkedIn + ATS overlap.
- **ATS requires a curated company list** we must seed and grow ([[ats-company-slug-sourcing]]).
- **LinkedIn guest is fragile** (undocumented HTML) and ToS-gray — ongoing parser upkeep, polite volume.

**Risks to track:**
- LinkedIn page/markup changes break the parser; LinkedIn anti-bot at higher volume.
- ATS coverage is only as good as the company list.
- JSearch's real Indeed/Wellfound coverage is unverified — don't assume it closes the gap until tested.

## Notes

- Supersedes nothing; first source-strategy ADR. Common model + adapter interface:
  [0003](./0003-normalized-job-model-and-source-interface.md).
- Durable per-source access facts: [[job-source-access-catalog]]. Walled/dropped rationale:
  [[antibot-blocked-boards]]. ATS company-list gap: [[ats-company-slug-sourcing]].
- Follow-up (cheap, do early): obtain free **Adzuna** + **JSearch** keys and run the validation to
  confirm Tier-2 data and whether the Indeed/Wellfound gap is closeable.
