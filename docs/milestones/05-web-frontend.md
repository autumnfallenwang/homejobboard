---
name: 05-web-frontend
status: active
created: 2026-06-08
---

# Milestone 05 — Web frontend

The Next.js UI the owner actually uses: a ranked feed of freshly-listed jobs, the filter config, a
job detail view, and a quick path to send out an application.

## Goal

`apps/web` renders the composite-ranked job feed from the API, lets the user tune `JobFilters` and
enable/disable sources, opens a job's detail (description + fitness + reasons), and offers a one-click
"send out" action.

## Scope / deliverables

`apps/web/src/`:
- **Feed view** (`/`) — ranked list of just-listed jobs: title, company, location, postedAt
  ("Xh ago"), fitness score badge, source tag. Newest/most-fit first; "new since last visit" marker.
- **Filters panel** — edit the `JobFilters` config (keywords, location, remote, level, postedSince)
  and toggle sources; persisted via the API.
- **Job detail** (`/jobs/:id`) — full description, salary/seniority/type, fitness score + `reasons`,
  links to the canonical `url` and `applyUrl`.
- **Send-out action** — the quick-apply path (see open question) — at minimum, open `applyUrl` and
  mark the job as actioned; optionally draft/track.
- `src/lib/api.ts` typed client over the shared schemas; loading/empty/error states.

## Exit criteria

- [ ] Feed shows API-ranked jobs with fitness + freshness; refresh reflects a new poll
- [ ] Filter + source changes persist and re-shape the feed
- [ ] Detail view renders full description + score + reasons + working apply link
- [ ] Send-out action works for at least the "open applyUrl + mark actioned" path
- [ ] `pnpm lint`, `pnpm test:fast`, `pnpm build` green

## Decisions (locked)

- **Reads go through the API** (no direct DB) — the API owns the contract.
- **Tailwind v4 baseline** (house pattern); keep it simple — single-user internal tool, not a product UI.

## Open questions

- **"Send out" semantics** (standing question #5): open apply URL only? draft an application? track
  applied/ignored state? Start with open+mark; expand later.
- Whether to surface fitness `reasons` inline or behind a click.

## Progress

- _not started_
