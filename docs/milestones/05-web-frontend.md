---
name: 05-web-frontend
status: done
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

- [x] Feed shows API jobs with fitness scores (Newest + Best-fit ranked tabs); Refresh re-polls + re-scores
- [x] Source toggles + status tabs persist and re-shape the feed (filters reinterpreted as source toggles + status, since `JobFilters` aren't wired into ingestion yet)
- [x] Detail view renders the description (safe plain-text), fitness score + reasons, and an Apply link
- [x] Send-out works: Apply opens the URL **and** marks `applied`; Dismiss/Reset too; actioned jobs leave the `new` feed (verified live)
- [x] `pnpm lint`, `pnpm test:fast` (api 26, web 8, shared 10), `pnpm build` green

## Decisions (locked)

- **Reads go through the API** (no direct DB) — the API owns the contract.
- **Tailwind v4 baseline** (house pattern); keep it simple — single-user internal tool, not a product UI.

## Open questions

- **"Send out" semantics** (standing question #5): open apply URL only? draft an application? track
  applied/ignored state? Start with open+mark; expand later.
- Whether to surface fitness `reasons` inline or behind a click.

## Progress

- 2026-06-08: Built the web UI. Backend: added a `status` column to `jobs` (migration `0002`,
  `new|applied|dismissed`) + `jobStatusSchema`/`status` in shared, `listFeed`/`setJobStatus` queries,
  `PATCH /jobs/:id`, an extended `GET /jobs` (sort/status, score attached), and a `settings` route
  (GET/PUT). Frontend (`apps/web`): typed `lib/api.ts` (request wrapper + `ApiClientError`),
  `lib/format.ts` (`formatRelativeTime`/`scoreColor`/`plainText`), `lib/utils.ts` (`cn`), an oklch
  theme, a header nav, the **feed** page (Newest/Best-fit tabs, status tabs, `RefreshButton`,
  `JobCard`+`ScoreBadge`), the **job detail** page (score + reasons + plain-text description +
  `ActionBar`), and the **settings** page (`ProfileEditor` + `SourceToggles` + poll/score). Deps:
  lucide-react, clsx, tailwind-merge. Check loop green (lint ✓ typecheck ✓ test:fast api 26/web 8/
  shared 10 ✓; integration 33 ✓; build ✓). **Live smoke:** feed renders ranked jobs with real
  fitness + reasons; Apply → `applied` removes the job from the `new` feed; settings shows the profile.
  (Debug note: a stale M01 `next start` was holding port 3000 and serving the old build — killed it.)

## Outcome

The owner now has a usable UI: a ranked just-listed feed with fitness scores, a detail view with the
LLM's reasons + apply link, send-out with applied/dismissed triage, and a settings page to edit the
fitness profile + toggle sources + trigger poll/score. The full product loop works end to end. Two
deliberate simplifications: descriptions render as **safe plain text** (no `dangerouslySetInnerHTML`),
and "filters" are **source toggles + status tabs** (server-side `JobFilters` aren't wired into
ingestion yet). Next: M06 deploy to k3s. The user should also set their real `fitness_profile` via the
settings page for meaningful scores.

Closed: 2026-06-08
