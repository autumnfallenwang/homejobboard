---
name: 10-tracking-and-followup
status: done
created: 2026-06-22
---

# Milestone 10 — Tracking state-machine + follow-up cadence

Turn the thin `applied/dismissed` state (M05) into a real application lifecycle, and add follow-up
cadence — the one place a manual, event-driven stage can still be semi-automated (compute "overdue,
nudge now" and draft the message). Realizes ADR [0004](../adr/0004-harvest-career-ops.md) Buckets
A-logic + B. Mapping: [[career-ops-harvest-map]].

## Goal

Each job the user engages with carries a canonical status through a defined lifecycle; the app
computes follow-up due-dates from the status + timestamps and can draft a follow-up message on
demand. The user still drives all real-world events manually; the app makes the next action obvious.

## Why (flow step 4)

Tracking is inherently manual and random (replies arrive whenever). But two things are computable:
**follow-up timing** (deterministic from dates) and **follow-up drafting** (one llmgw call). Everything
else is the user updating status.

## Scope / deliverables

- **Status state-machine (Bucket B — model, not code):** adopt career-ops's canonical states from
  `poc/career-ops/templates/states.yml` — `Evaluated → Applied → Responded → Interview → Offer →
  Rejected / Discarded`. Add a Drizzle migration extending the application/job tracking table beyond
  `applied/dismissed`; encode allowed transitions in `packages/shared` (Zod enum + a transition guard).
- **Cadence logic (Bucket A — port logic, not I/O):** port the calculation core of
  `poc/career-ops/followup-cadence.mjs` (esp. `DEFAULT_CADENCE` + the due-date math) →
  `apps/api/src/tracking/cadence.ts`, but **feed it DB rows** instead of parsing `applications.md`.
  Output: per-application `nextFollowUpAt` + `overdue` flag.
- **Follow-up drafting (Bucket B):** one llmgw call `(application, job, history) → follow-up draft`
  when the user asks; never sent automatically.
- **API + web:** status transitions (`PATCH /applications/:id`), an "overdue follow-ups" view/badge,
  a "draft follow-up" action. Tracking becomes a first-class section, not just a dismiss toggle.

## Exit criteria

- [x] Tracking columns + Zod enum cover the full canonical lifecycle; illegal transitions rejected (`canTransition` guard in the PATCH route + unit-tested)
- [x] `cadence.ts` computes `nextFollowUpAt` / `overdue` from DB rows (ported math, unit-tested; live-verified overdue)
- [x] Web shows status per application + an overdue-follow-ups view (`/tracking`); user advances status from the detail ActionBar
- [x] "Draft follow-up" returns an editable message via one llmgw call (live via the primary model); nothing is auto-sent
- [x] `pnpm lint` / `typecheck` / `test:fast` (108) / `build` green

## Decisions (locked)

- Adopt career-ops's **state names** as canonical (no markdown-bold/date-in-status baggage — we use columns/DB).
- Port cadence **math only**; the markdown-file parsing in `followup-cadence.mjs` is Bucket D (dropped).
- Follow-up sends are always manual (consistent with M09 / the no-auto-submit ethic).

## Open questions

- ~~dismissed vs Discarded~~ — resolved: **merged** into a single `discarded` (data migration renamed existing rows); `new` stays the inbox default.
- ~~Default cadence values~~ — resolved: keep career-ops's `DEFAULT_CADENCE` (retune later if the single-user pace differs).

## Progress

- 2026-06-23: Shipped the tracking lifecycle + follow-up cadence (ADR 0004 Buckets A-logic + B).
  `jobStatusSchema` is now the 7-state lifecycle (new → applied → responded → interview → offer →
  rejected / discarded) with `STATUS_TRANSITIONS` + `canTransition` in `packages/shared`; the jobs
  table gains `appliedAt`/`statusChangedAt`/`lastFollowUpAt`/`followUpCount` (migration `0004`, which
  also migrates the retired `dismissed` → `discarded`). Ported the cadence math to
  `apps/api/src/tracking/cadence.ts` (`DEFAULT_CADENCE`, `computeUrgency`, `computeNextFollowUpAt`,
  `followUpInfo`); follow-up drafting in `tracking/followup.ts` (career-ops `followup.md` guardrails,
  mirrors M09). Routes: PATCH transition guard, `POST /jobs/:id/followup{,-draft}`, `GET /tracking`.
  Web: lifecycle ActionBar, a `FollowUpPanel` (cadence + draft + mark-sent), a `/tracking` overdue-first
  page, an overdue header badge, and the Dismissed→Discarded tab rename. lint / typecheck / test:fast
  (108) / build green.
- 2026-06-23: **Live smoke** (real DB + primary model) — new→applied stamped `appliedAt`; backdating it
  10 days made the job `overdue` (next-follow-up = applied + 7d); `feedStats.overdue` = 1; `/tracking`
  listed it overdue-first; the follow-up draft generated via the **primary `claude-sonnet-4-5`** —
  grounded and faithful (referenced the role + ~10-day timing, led with the CV's "p95 38%" metric, soft
  ask, no banned phrases). Smoke caught + fixed a real bug: `setJobStatus`'s `coalesce(applied_at, $date)`
  raw-SQL form failed to bind the Date (postgres-js) → reworked to a fetch-then-set (drizzle serializes
  the Date correctly).

## Outcome

**Closed: 2026-06-23.** Shipped the track/learn lifecycle (ADR 0004 Buckets A-logic + B). `jobs.status`
became the 7-state canonical lifecycle (`new → applied → responded → interview → offer → rejected /
discarded`) with a shared `STATUS_TRANSITIONS` + `canTransition` guard (enforced in the PATCH route) and
four tracking columns (migration `0004`, which also merged the retired `dismissed` → `discarded`).
Ported career-ops's cadence math (`apps/api/src/tracking/cadence.ts`) to compute `nextFollowUpAt` /
`overdue` per application, and follow-up drafting (`tracking/followup.ts`) as one llmgw call with the
`followup.md` guardrails. Web gained lifecycle controls, a follow-up panel (draft + mark-sent), and a
`/tracking` overdue-first view + header badge. lint / typecheck / test:fast (108) / build green;
live-verified end-to-end through the primary `claude-sonnet-4-5` (lifecycle, overdue cadence, grounded
follow-up draft).

**Decisions:** extended `jobs.status` rather than a separate applications table (fits the pervasive
existing usage); merged `dismissed`→`discarded`; kept career-ops `DEFAULT_CADENCE`. A smoke-caught
drizzle/postgres-js Date-binding bug in `setJobStatus` was fixed and captured: [[drizzle-date-in-raw-sql]].

**Deferred (milestone open Q resolved):** cadence retuning for single-user pace — revisit if needed.
