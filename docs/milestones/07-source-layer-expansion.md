---
name: 07-source-layer-expansion
status: done
created: 2026-06-22
---

# Milestone 07 — Source-layer expansion (more providers)

Widen ingestion coverage by adding the source kinds we don't yet have, porting the proven
endpoint knowledge from career-ops's provider plugins into our typed `Source` interface, and
finishing the already-researched-but-unbuilt sources. Realizes ADR
[0004](../adr/0004-harvest-career-ops.md) Bucket C, executing the tiered strategy of ADR
[0002](../adr/0002-job-source-access-strategy.md). Per-source facts: `knowledge/job-source-access-catalog.md`,
mapping: [[career-ops-harvest-map]].

## Goal

`runPoll()` ingests from materially more of the market — especially **Workday** (the largest
enterprise ATS gap) — through new adapters that conform to the existing two-stage `Source`
contract (ADR [0003](../adr/0003-normalized-job-model-and-source-interface.md)), with no change to
the normalize → filter → dedup → store → score pipeline.

## Why (flow step 2)

This is the automatic, zero-LLM "acquire" stage. Coverage is bounded by adapter count + the ATS
company list; career-ops already wrote and live-validated adapters for ATS platforms we lack, so we
port their endpoint/parsing knowledge rather than re-research.

## Scope / deliverables

New adapters in `apps/api/src/sources/` (each: pure `parse*` + `fetch→parse` `search()`; no DB
writes inside the adapter; fixture tests from saved sample responses):

- **Tier 1 — ATS we lack (port from career-ops `poc/career-ops/providers/`):**
  - `workday.ts` — POST CXS jobs endpoint, **paginated**; auto-detect tenant/site from a
    `*.myworkdayjobs.com/<locale>/<site>` careers URL. Highest-value add (Fortune-500 coverage).
    Port the detect + pagination logic from `poc/career-ops/providers/workday.mjs`.
  - `smartrecruiters.ts` — public postings API (`api.smartrecruiters.com/v1/companies/{slug}/postings`);
    from `poc/career-ops/providers/smartrecruiters.mjs`.
  - `recruitee.ts` — per-tenant offers API (`{slug}.recruitee.com/api/offers`); SSRF-safe slug
    regex; from `poc/career-ops/providers/recruitee.mjs`.
  - `workable.ts` — no-auth markdown feed (`apply.workable.com/{slug}/jobs.md`); from
    `poc/career-ops/providers/workable.mjs`.
  - *(optional)* `ibm.ts` — single-company careers search API; only if IBM is a target.
- **Tier 2 — free-key (standing Q#3, non-blocking; self-disable if env key absent):**
  `adzuna.ts` (`sort_by=date` + `max_days_old`), `usajobs.ts` (`DatePosted`). Already specced in
  M03 scope; finish them.
- **Tier 3 — already researched, not yet built:** `builtin.ts` (`?daysSinceUpdated=1`), `otta.ts`
  (Welcome-to-the-Jungle per-job GraphQL / Apollo state). Validated 2026-06-08; add when convenient.
- **Liveness gate (Bucket A drop-in):** port `poc/career-ops/liveness-core.mjs` → a pure
  `apps/api/src/sources/liveness.ts` (expired / live / uncertain classifier incl. anti-bot
  interstitial detection); use it in the enrichment/verify path to drop dead postings before scoring.
- **Better dedup (Bucket A drop-in):** port `poc/career-ops/role-matcher.mjs` →
  `apps/api/src/services/role-match.ts` and use it inside `dedup.ts` so "Senior X" / "X" at the
  same company collapse (today's key is raw `company+title+location`).
- **Seed + UI:** add starter company tokens for the new ATS kinds to the `sources` seed; the
  existing settings add-board form already manages them (05b).

## Exit criteria

- [x] `POST /poll` ingests from ≥1 Workday board + ≥1 each of SmartRecruiters / Recruitee, normalized correctly (`postedAt` = original-post time), fixture + live-smoke verified — **Workable**: adapter format-verified + unit-tested, but its public `jobs.md` feed is upstream-empty (header-only for all ~40 tenants probed), so 0 live rows (see Outcome)
- [x] Adapters self-disable cleanly when a token is dead or a key is missing (per-source error isolation, as M03) — demonstrated: a dead recruitee tenant 404'd and was isolated while the other boards ingested
- [x] `liveness.ts` classifier ports with its unit tests; verify path drops a known-expired URL
- [x] `role-match.ts` dedup collapses a known "Senior X"/"X" same-company pair (regression test)
- [x] No regression: existing 8 adapters + filter gating + scoring path stay green
- [x] `pnpm lint` / `typecheck` / `test:fast` / `build` green

## Decisions (locked)

- Port **endpoint + parsing knowledge**, not files — re-express each provider as a typed `Source`;
  copy career-ops's saved sample responses into `apps/api` tests as fixtures (poc is gitignored).
- Region-specific providers (`glints`, `jobstreet`, `solidjobs`, `arbeitsagentur`, `workingnomads`)
  are **optional / not planned** for the US-tech profile (ADR 0002) — revisit only if targeting shifts.
- Indeed / Wellfound stay **deferred** (ADR 0002); this milestone does not reopen them.

## Open questions

- Workday CXS pagination + per-tenant quirks — confirm against ≥2 live tenants before relying on it.
- Adzuna / USAJobs free keys (standing Q#3) — still the only blocker for Tier 2.
- Whether the liveness check runs inline in `runPoll` or as a separate sweep (cost vs freshness).

## Progress

- 2026-06-22: Shipped the full core — Tier-1 ATS adapters `workday` (POST CXS, paginated,
  tenant auto-detect via `detectWorkday`), `smartrecruiters`, `recruitee` (SSRF-safe slug/host),
  `workable` (markdown feed), each a pure `parse*` + factory with fixture tests; added the 4 kinds
  to `sourceKindSchema` + registry + seed (starter tokens unverified — validate in live smoke).
  Ported `liveness.ts` (`classifyLiveness` + tested `checkLiveness`, **not** wired into `runPoll` —
  inline-vs-sweep deferred) and `role-match.ts`, integrated as an additive fuzzy-merge pass in
  `dedup.ts` (collapses cross-source "Senior X"/"X" at same company+location). Web add-board form
  gained `recruitee`/`workable`. lint / typecheck / test:fast (76) / build all green.
- 2026-06-22: Live smoke (direct adapter `search()` against real boards) — **workday:nvidia →
  1000** (safety cap; tenant has 2000), **smartrecruiters:Visa → 6**, **recruitee:bunq → 30**, all
  normalized correctly (`postedAt`, URLs, workplaceType, recruitee descriptions present).
  `checkLiveness` live: a 404 URL → `expired`, a content page → kept (exit #3 ✓). Smoke caught a
  recruitee bug — tenants with branded careers domains (`jobs.channable.com`, `careers.bunq.com`)
  had every offer dropped by the `*.recruitee.com` host guard; fixed by synthesizing the canonical
  `<slug>.recruitee.com/o/<offer-slug>` URL (SSRF-safe) and keeping the branded URL as `applyUrl`,
  plus ISO date normalization + hybrid/onsite mapping. **Workable:** the public `jobs.md` feed
  returns header-only (0 rows) for every tenant probed (~40); parser format verified against the
  live table + unit-tested, but no populated board found — ingests 0 for now. **Remaining before
  close:** confirm Workday CXS against a 2nd tenant; Tier-2 (adzuna/usajobs), Tier-3 (builtin/otta),
  `ibm`, and wiring liveness into `runPoll` stay deferred.
- 2026-06-22: Full `POST /poll` round-trip verified against a real Postgres (migrate + seed +
  `runPoll`) — **workday:nvidia** ingested 415 fresh rows (1000 fetched, 585 outside the 14d
  window, 25 enriched), **recruitee:bunq** 1 fresh row (postedAt + description), **smartrecruiters:
  visa** 6 rows with a widened window (its 6 live postings are all >14d old, correctly excluded by
  default). A deliberately-dead recruitee tenant returned 404 and was isolated while the others kept
  ingesting (self-disable ✓). **workable:deel** ingested 0 — the public `jobs.md` feed is upstream-
  empty. Milestone closed.

## Outcome

**Closed: 2026-06-22.** Shipped M07's full core: four Tier-1 ATS adapters (Workday,
SmartRecruiters, Recruitee, Workable) ported from career-ops (MIT) into the typed two-stage
`Source` contract, plus the Bucket-A drop-ins — a pure `liveness.ts` classifier (`classifyLiveness`
+ tested `checkLiveness`) and `role-match.ts` integrated as an additive fuzzy-merge pass in
`dedup.ts`. Live-validated end-to-end through `POST /poll`: Workday, SmartRecruiters, and Recruitee
all ingest and store normalized rows with original-post timestamps; per-source error isolation
holds. `lint`/`typecheck`/`test:fast` (76)/`build` green.

**Deviations from plan:** (1) Smoke testing caught a Recruitee bug — tenants with branded careers
domains (`jobs.channable.com`, `careers.bunq.com`) had every offer dropped by the `*.recruitee.com`
host guard; fixed by synthesizing the canonical, SSRF-safe `<slug>.recruitee.com/o/<offer-slug>` URL
and keeping the branded URL as `applyUrl`, plus ISO date normalization and hybrid/onsite mapping.
(2) **Workable could not be live-verified** — its public no-auth `jobs.md` feed returns a header-
only table (zero job rows) for every tenant probed (~40, incl. populated employers like Deel). The
adapter matches the live table format exactly and is unit-tested with a fixture, but no public
board surfaced rows; if the feed never repopulates, a follow-up could pivot Workable to the
no-auth widget JSON API (`apply.workable.com/api/v3/accounts/<slug>/jobs`).

**Deferred (out of scope, not blocking):** Tier-2 free-key adapters (`adzuna`/`usajobs`, gated on
keys), Tier-3 (`builtin`/`otta`), single-company `ibm`, a 2nd Workday tenant confirmation, and
wiring liveness inline into `runPoll` (the inline-vs-sweep cost question — see ADR-worthy follow-up).

**Lesson captured:** [[turbo-verification-commands]] — verify via the turbo scripts, not root tsc/vitest.
