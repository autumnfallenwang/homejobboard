# 0003 — Normalized job model & source adapter interface

- **Status:** accepted
- **Date:** 2026-06-08
- **Deciders:** project founder (decided from the 2026-06-08 research round)

## Context

We ingest jobs from heterogeneous sources (ADR [0002](./0002-job-source-access-strategy.md)):
ATS JSON, clean feed APIs, free-key aggregators, and HTML guest scrapes. Research established
two facts that drive the model:

1. **Sources split into a two-stage shape.** A *list/search* response gives identity + display
   fields; a *detail* fetch gives the full description. For clean sources (ATS, RemoteOK, …) the
   description already arrives in stage 1 (stage 2 is a no-op); for LinkedIn guest, stage 2 is a
   separate fetch. The model must accommodate both without special-casing the pipeline.
2. **No source offers a server-side "posted in the last N minutes" *cursor*.** Most expose a
   per-record original-post timestamp (`first_published` / `createdAt` / `publishedAt` /
   `postedAt` / epoch) and newest-first ordering, but "just-listed" must be computed by us
   (poll + diff on the timestamp). A few (LinkedIn `f_TPR`, Adzuna `max_days_old`, USAJobs
   `DatePosted`, BuiltIn `daysSinceUpdated`) offer a coarse server-side day/hour window.

This mirrors the proven `homenews` shape (`feed`→`article`→`reader`→`analysis`); we reuse it.

## Decision

**1. One normalized `Job` model** every adapter maps onto, defined as Zod schemas in
`packages/shared` (the API↔web contract). Core fields (superset; sources fill what they have):

```
identity : source, sourceJobId, url, applyUrl?
display  : title, company, location?, workplaceType? (remote|hybrid|onsite)
freshness: postedAt (ISO, original-post time)        ← the "just-listed" signal
scoring  : description (full text/HTML), salaryMin?, salaryMax?,
           employmentType?, seniority?, tags?
meta     : fetchedAt, raw? (source-specific extras), dedupKey
```

**2. A two-stage `Source` adapter interface** — the tier/access-method of a source never leaks past it:

```ts
interface Source {
  id: string                                  // e.g. "greenhouse:stripe", "linkedin", "remoteok"
  search(filters: JobFilters): Promise<JobSummary[]>   // stage 1
  fetchDetail(summary: JobSummary): Promise<JobDetail> // stage 2 (no-op for clean sources)
}
```
- `JobFilters` is the cross-source filter config (keywords, location, remote, postedSince, level…).
  Each adapter translates it into its own query (LinkedIn `f_*`, Adzuna params, ATS = client-side, …).
- Clean sources return full data from `search`; `fetchDetail` just returns what they already have.

**3. "Just-listed" = poll + diff.** The scheduler polls each enabled source, and a job is "new"
if its `dedupKey` is unseen. Where a source offers a server-side window (LinkedIn/Adzuna/USAJobs/
BuiltIn) we pass it to narrow the pull; otherwise we read newest-first and stop at known IDs.

**4. Dedup across sources** via `dedupKey = normalize(company + title + location)` plus
`(source, sourceJobId)` for within-source identity. The same job from LinkedIn + an ATS collapses
to one record (keep the richest description; record all source URLs).

**5. Scoring decoupled from ingestion.** Only **new, deduped, filter-passing** jobs are sent to the
LLM (via the cluster `llmgw`) for a fitness score — never the whole pull (cost). Score + freshness
combine into a composite rank for display. (Details in milestone 04.)

## Consequences

**Positive:**
- Adding a source = writing one adapter; the pipeline, dedup, scoring, and UI never change.
- One language end-to-end with shared Zod schemas — no cross-boundary serialization drift.
- Clean sources cost one call; only LinkedIn-style sources pay for stage 2.
- Scoring stays cheap (new jobs only).

**Negative / trade-offs:**
- The `Job` superset has many nullable fields (sources vary) — the UI must tolerate missing
  salary/seniority/location.
- Client-side dedup/just-listed means we **store and diff** per-source state (seen IDs) rather than
  trusting a server cursor.
- `dedupKey` normalization is heuristic; over/under-merging is possible and needs tuning.

**Risks to track:**
- Timestamp semantics differ per source (`updated_at` vs original post; republish noise) — normalize
  carefully so "just-listed" isn't polluted by edits.
- Dedup false-merges hiding a distinct role.

## Notes

- Realizes the source layer chosen in ADR [0002](./0002-job-source-access-strategy.md).
- Field availability per source: [[job-source-access-catalog]].
- Built in milestones [02](../milestones/02-data-model-and-shared-schema.md) (model + interface)
  and [03](../milestones/03-source-adapters-and-ingestion.md) (adapters + pipeline).
