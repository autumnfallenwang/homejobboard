---
name: 10-tracking-and-followup
status: proposed
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

- [ ] Tracking table + Zod enum cover the full canonical lifecycle; illegal transitions rejected
- [ ] `cadence.ts` computes `nextFollowUpAt` / `overdue` from DB rows (unit tests on the ported math)
- [ ] Web shows status per application + an overdue-follow-ups view; user can advance status
- [ ] "Draft follow-up" returns an editable message via one llmgw call; nothing is auto-sent
- [ ] `pnpm lint` / `typecheck` / `test:fast` / `build` green

## Decisions (locked)

- Adopt career-ops's **state names** as canonical (no markdown-bold/date-in-status baggage — we use columns/DB).
- Port cadence **math only**; the markdown-file parsing in `followup-cadence.mjs` is Bucket D (dropped).
- Follow-up sends are always manual (consistent with M09 / the no-auto-submit ethic).

## Open questions

- Do `dismissed` (feed triage) and `Discarded` (tracked-then-dropped) stay distinct, or merge?
- Default cadence values — keep career-ops's `DEFAULT_CADENCE` or retune for a single-user pace.
