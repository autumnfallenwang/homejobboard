import {
  dedupKey,
  type JobFilters,
  type JobSummary,
  matchesFilters,
  type Source,
} from "@homejobboard/shared";
import type { Database } from "../db/index.js";
import {
  dedupRows,
  insertJobs,
  type JobRow,
  type NewJob,
  setDuplicateOf,
  setLastPolled,
  updateJobDetail,
} from "../db/queries.js";
import { log } from "../lib/logger.js";
import { buildSource, enabledSourceConfigs } from "../sources/registry.js";
import { markDuplicates } from "./dedup.js";
import { getJobFilters } from "./settings.js";

// Stage-2 enrichment politeness bounds (per source, per poll).
const MAX_DETAIL_PER_SOURCE = 25;
const DETAIL_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PollSourceResult {
  slug: string;
  fetched: number;
  /** Summaries dropped by the pre-ingestion JobFilters pass. */
  filtered: number;
  inserted: number;
  enriched: number;
  error?: string;
}
export interface PollSummary {
  perSource: PollSourceResult[];
  inserted: number;
  duplicates: number;
}

/** Convert an adapter's normalized summary into a DB insert row. */
function toJobRow(s: JobSummary): NewJob {
  return {
    source: s.source,
    sourceJobId: s.sourceJobId,
    url: s.url,
    applyUrl: s.applyUrl ?? null,
    title: s.title,
    company: s.company,
    location: s.location ?? null,
    workplaceType: s.workplaceType ?? null,
    postedAt: s.postedAt ? new Date(s.postedAt) : null,
    description: s.description ?? null,
    salaryMin: s.salaryMin ?? null,
    salaryMax: s.salaryMax ?? null,
    employmentType: s.employmentType ?? null,
    seniority: s.seniority ?? null,
    tags: s.tags ?? null,
    dedupKey: dedupKey(s.company, s.title, s.location),
  };
}

/** One source to poll: its slug + a lazy builder (built inside error isolation). */
interface PollEntry {
  slug: string;
  build: () => Source;
}

/**
 * Poll enabled sources with the stored `job_filters`: each source's `search(filters)`
 * applies what it can server-side, then `matchesFilters` drops the rest client-side
 * before insert (ADR 0003: only new + filter-passing jobs are stored/scored). A
 * cross-source dedup pass follows. Per-source failures are isolated. `opts.sources`
 * restricts to a subset of slugs. `opts.entries` injects pre-built sources (tests).
 * `opts.filters` overrides the stored filters. `now` is injectable for tests.
 */
export async function runPoll(
  db: Database,
  opts: {
    sources?: string[];
    entries?: Array<{ slug: string; source: Source }>;
    filters?: JobFilters;
    now?: Date;
  } = {},
): Promise<PollSummary> {
  const now = opts.now ?? new Date();
  const filters = opts.filters ?? (await getJobFilters(db));

  let entries: PollEntry[];
  if (opts.entries) {
    entries = opts.entries.map((e) => ({ slug: e.slug, build: () => e.source }));
  } else {
    let configs = await enabledSourceConfigs(db);
    if (opts.sources?.length) configs = configs.filter((c) => opts.sources!.includes(c.slug));
    else if (filters.sources?.length)
      configs = configs.filter((c) => filters.sources!.includes(c.slug));
    entries = configs.map((c) => ({ slug: c.slug, build: () => buildSource(c) }));
  }

  const perSource: PollSourceResult[] = [];
  let inserted = 0;

  for (const entry of entries) {
    try {
      const source = entry.build();
      const summaries = await source.search(filters);
      const kept = summaries.filter((s) => matchesFilters(s, filters, now));
      const rows = kept.map(toJobRow);
      const newRows = await insertJobs(db, rows);
      inserted += newRows.length;
      const enriched = await enrichNewRows(db, source, kept, newRows);
      perSource.push({
        slug: entry.slug,
        fetched: summaries.length,
        filtered: summaries.length - kept.length,
        inserted: newRows.length,
        enriched,
      });
      await setLastPolled(db, entry.slug, now);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ event: "poll.source.failed", slug: entry.slug, err: msg }, "source poll failed");
      perSource.push({
        slug: entry.slug,
        fetched: 0,
        filtered: 0,
        inserted: 0,
        enriched: 0,
        error: msg,
      });
    }
  }

  const duplicates = await applyDedup(db);
  log.info({ event: "poll.done", inserted, duplicates }, "poll complete");
  return { perSource, inserted, duplicates };
}

/**
 * Stage-2 enrichment: for newly-inserted rows missing a description, call the
 * source's `fetchDetail` and persist the result. Clean sources (description already
 * present) are skipped entirely. Bounded + throttled to stay polite; per-row errors
 * are isolated. Returns how many rows were enriched.
 */
async function enrichNewRows(
  db: Database,
  source: Source,
  summaries: JobSummary[],
  newRows: JobRow[],
): Promise<number> {
  const needsDetail = newRows.filter((r) => r.description == null);
  if (needsDetail.length === 0) return 0;

  const byJobId = new Map(summaries.map((s) => [s.sourceJobId, s]));
  let enriched = 0;
  for (const row of needsDetail) {
    if (enriched >= MAX_DETAIL_PER_SOURCE) break;
    const summary = byJobId.get(row.sourceJobId);
    if (!summary) continue;
    try {
      const detail = await source.fetchDetail(summary);
      await updateJobDetail(db, row.id, detail);
      enriched++;
      await sleep(DETAIL_DELAY_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(
        { event: "poll.detail.failed", jobId: row.sourceJobId, err: msg },
        "detail fetch failed",
      );
    }
  }
  return enriched;
}

/** Cross-source dedup pass over the whole table. Returns the number of rows marked. */
async function applyDedup(db: Database): Promise<number> {
  const rows = await dedupRows(db);
  const dupMap = markDuplicates(rows);
  for (const [id, canonicalId] of dupMap) {
    await setDuplicateOf(db, id, canonicalId);
  }
  return dupMap.size;
}
