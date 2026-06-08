---
name: job-source-access-catalog
description: How to access each selected job source — endpoints, auth, fields, just-listed (from the 2026-06-08 research round)
metadata:
  type: reference
---

Durable extract of the 2026-06-08 facts-only research round (raw corpus was in `poc/`, which is
gitignored). These are the **selected** sources from ADR [[0002-job-source-access-strategy]] and how
to reach them. Field mapping → the normalized `Job` model is ADR
[[0003-normalized-job-model-and-source-interface]]. All "live_validated" entries were hit live on
2026-06-08; "needs key" entries had their request shape confirmed but no authed response observed.

## Tier 1 — clean, zero-auth, full data (build first)

| Source | Endpoint | Auth | Just-listed signal | Status |
|---|---|---|---|---|
| **Greenhouse** | `GET boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` (detail `/jobs/{id}`) | none | `first_published` (ISO); no server filter → diff client-side | live_validated (stripe, gitlab) |
| **Lever** | `GET api.lever.co/v0/postings/{company}?mode=json` (EU: `api.eu.lever.co`) | none | `createdAt` (epoch ms) | live_validated |
| **Ashby** | `GET api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` | none | `publishedAt` (ISO) | live_validated |
| **RemoteOK** | `GET remoteok.com/api` (`?tag=`) — **skip element[0]** (legal notice) | none | `date` (newest-first); full `description` inline | live_validated |
| **Remotive** | `GET remotive.com/api/remote-jobs` (`/categories`) | none | `publication_date` (ISO) | live_validated |
| **We Work Remotely** | RSS feed (per-category + full) | none | `<pubDate>` | live_validated (RSS) |
| **HN "Who is Hiring"** | HN Firebase API + `hn.algolia.com/api/v1/search` on the latest monthly thread | none | comment `time` (epoch) | live_validated |

- ATS sources (Greenhouse/Lever/Ashby) are **per-company** — no enumerate-all endpoint. Need a
  company-token list → [[ats-company-slug-sourcing]]. They return **full descriptions in stage 1**.
- RemoteOK ToS: **must link back / attribute** or access may be suspended; honor it.

## Tier 2 — free, needs a free key (validate at build)

| Source | Endpoint | Auth | Just-listed | Status |
|---|---|---|---|---|
| **Adzuna** | `GET api.adzuna.com/v1/api/jobs/{country}/search/{page}?app_id=&app_key=&what=&where=&sort_by=date&max_days_old=1` | free key (app_id+app_key) | `sort_by=date` + `max_days_old` (yes) | blocked(needs_key) — endpoint live, authed fetch not run |
| **USAJobs** | `GET data.usajobs.gov/api/search?DatePosted=&SortField=PublicationStartDate&SortDirection=Desc` | free key (email + `Authorization-Key` header) | `DatePosted` last-N-days (yes) | blocked(needs_key) — `DEMO_KEY`→401 |

## Tier 3 — free public-web / guest scrape (accept maintenance + ToS-gray)

| Source | Endpoint | Auth | Just-listed | Status |
|---|---|---|---|---|
| **LinkedIn** | list `GET linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=&location=&f_TPR=r86400&sortBy=DD&start=` · detail `GET .../jobPosting/{jobId}` | none | `f_TPR` (`r3600`/`r86400`) — true server-side window (yes) | live_validated — **HTML parse, ToS-gray, polite volume**; this is the only adapter with a real Stage-2 fetch |
| **BuiltIn** | public board, `?daysSinceUpdated=1` | none | `daysSinceUpdated` (yes) | live_validated |
| **Otta / Welcome to the Jungle** | `POST api.exp.welcometothejungle.com/graphql` `publicJob(externalId)`; or SSR page `app.welcometothejungle.com/jobs/<id>` (base64 `__APOLLO_STATE__`) | none | `insertedAt` (ISO) | live_validated — cross-company **search needs login**; per-job is public |

LinkedIn adapter reference implementation existed in the POC (`poc/linkedin_url_fetch.py`) — port its
list+detail logic and saved HTML fixtures into `apps/api` tests (poc is gitignored).

## Deferred (no free path; revisit only via a paid-aggregator trial)

- **Indeed** — legacy `api.indeed.com/ads/apisearch` retired; site Cloudflare-walled. Paid aggregators
  (JSearch / Adzuna) *claim* coverage — **unvalidated**.
- **Wellfound** — legacy AngelList jobs API gone post-rebrand; DataDome-walled. Paid Apify actors only.
- A single free **JSearch** key (RapidAPI, 200 req/mo) is the cheapest way to test whether either gap
  is closeable — do this early, it's minutes.

## Dropped (not worth it for the tech/US/free-first profile)

Glassdoor (Cloudflare 403, partner-gated) · ZipRecruiter (partner-key, not a search API) ·
Dice (search API retired; only HTML scrape) · Google for Jobs (no read API; SerpApi is paid) ·
niche crypto/VC boards (token-gated) · YC "Work at a Startup" (no public posted-date field, 28-job
cap, search needs login). Rationale: [[antibot-blocked-boards]].
