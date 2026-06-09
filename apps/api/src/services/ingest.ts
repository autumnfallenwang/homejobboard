import { dedupKey, type JobSummary, type Source } from "@homejobboard/shared";
import type { Database } from "../db/index.js";
import {
  dedupRows,
  insertJobs,
  type NewJob,
  setDuplicateOf,
  setLastPolled,
} from "../db/queries.js";
import { log } from "../lib/logger.js";
import { buildSource, enabledSourceConfigs } from "../sources/registry.js";
import { markDuplicates } from "./dedup.js";

export interface PollSourceResult {
  slug: string;
  fetched: number;
  inserted: number;
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
 * Poll enabled sources, normalize → store new jobs (skip already-seen), then run a
 * cross-source dedup pass. Per-source failures are isolated. `opts.sources` restricts
 * to a subset of slugs. `opts.entries` injects pre-built sources (tests). `now` is
 * injectable for deterministic tests.
 */
export async function runPoll(
  db: Database,
  opts: { sources?: string[]; entries?: Array<{ slug: string; source: Source }>; now?: Date } = {},
): Promise<PollSummary> {
  const now = opts.now ?? new Date();

  let entries: PollEntry[];
  if (opts.entries) {
    entries = opts.entries.map((e) => ({ slug: e.slug, build: () => e.source }));
  } else {
    let configs = await enabledSourceConfigs(db);
    if (opts.sources?.length) configs = configs.filter((c) => opts.sources!.includes(c.slug));
    entries = configs.map((c) => ({ slug: c.slug, build: () => buildSource(c) }));
  }

  const perSource: PollSourceResult[] = [];
  let inserted = 0;

  for (const entry of entries) {
    try {
      const source = entry.build();
      const summaries = await source.search({ keywords: [] });
      const rows = summaries.map(toJobRow);
      const newRows = await insertJobs(db, rows);
      inserted += newRows.length;
      perSource.push({ slug: entry.slug, fetched: summaries.length, inserted: newRows.length });
      await setLastPolled(db, entry.slug, now);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ event: "poll.source.failed", slug: entry.slug, err: msg }, "source poll failed");
      perSource.push({ slug: entry.slug, fetched: 0, inserted: 0, error: msg });
    }
  }

  const duplicates = await applyDedup(db);
  log.info({ event: "poll.done", inserted, duplicates }, "poll complete");
  return { perSource, inserted, duplicates };
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
