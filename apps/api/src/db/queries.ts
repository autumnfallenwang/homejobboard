import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "./index.js";
import { jobs, sources } from "./schema.js";

export type NewJob = typeof jobs.$inferInsert;
export type JobRow = typeof jobs.$inferSelect;
export type SourceRow = typeof sources.$inferSelect;

/** Bulk-insert jobs, skipping rows whose (source, sourceJobId) already exists.
 *  Returns the rows actually inserted ("new" jobs). */
export async function insertJobs(db: Database, rows: NewJob[]): Promise<JobRow[]> {
  if (rows.length === 0) return [];
  return db
    .insert(jobs)
    .values(rows)
    .onConflictDoNothing({ target: [jobs.source, jobs.sourceJobId] })
    .returning();
}

export interface ListJobsOpts {
  limit?: number;
  offset?: number;
  source?: string;
  includeDuplicates?: boolean;
}

/** Newest-first by postedAt (nulls last), then fetchedAt. Excludes duplicates by default. */
export function listJobs(db: Database, opts: ListJobsOpts = {}): Promise<JobRow[]> {
  const { limit = 50, offset = 0, source, includeDuplicates = false } = opts;
  const conds = [];
  if (!includeDuplicates) conds.push(isNull(jobs.duplicateOfId));
  if (source) conds.push(eq(jobs.source, source));

  return db
    .select()
    .from(jobs)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(sql`${jobs.postedAt} desc nulls last`, desc(jobs.fetchedAt))
    .limit(limit)
    .offset(offset);
}

export async function getJob(db: Database, id: string): Promise<JobRow | undefined> {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return row;
}

/** All rows needed for the cross-source dedup pass. */
export function dedupRows(
  db: Database,
): Promise<Array<{ id: string; source: string; dedupKey: string; fetchedAt: Date }>> {
  return db
    .select({
      id: jobs.id,
      source: jobs.source,
      dedupKey: jobs.dedupKey,
      fetchedAt: jobs.fetchedAt,
    })
    .from(jobs);
}

export async function setDuplicateOf(db: Database, id: string, canonicalId: string): Promise<void> {
  await db.update(jobs).set({ duplicateOfId: canonicalId }).where(eq(jobs.id, id));
}

export function listSources(db: Database): Promise<SourceRow[]> {
  return db.select().from(sources).orderBy(sources.slug);
}

export async function updateSource(
  db: Database,
  id: string,
  patch: { enabled?: boolean; params?: Record<string, unknown> },
): Promise<SourceRow | undefined> {
  const [row] = await db.update(sources).set(patch).where(eq(sources.id, id)).returning();
  return row;
}

export async function setLastPolled(db: Database, slug: string, at: Date): Promise<void> {
  await db.update(sources).set({ lastPolledAt: at }).where(eq(sources.slug, slug));
}
