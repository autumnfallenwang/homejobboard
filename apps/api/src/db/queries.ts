import {
  ACTIVE_STATUSES,
  composite,
  type FeedStats,
  type FollowUpInfo,
  freshness,
  type JobStatus,
} from "@homejobboard/shared";
import { and, count, desc, eq, ilike, inArray, isNull, like, max, or, sql } from "drizzle-orm";
import { followUpInfo } from "../tracking/cadence.js";
import type { Database } from "./index.js";
import { jobScores, jobs, sources } from "./schema.js";

export type NewJob = typeof jobs.$inferInsert;
export type JobRow = typeof jobs.$inferSelect;
export type SourceRow = typeof sources.$inferSelect;
export type NewScore = typeof jobScores.$inferInsert;
export type ScoreRow = typeof jobScores.$inferSelect;
export type RankedJob = JobRow & { score: ScoreRow; rank: number };
export type FeedJob = JobRow & { score: ScoreRow | null; rank: number };
export type TrackedJob = JobRow & { followUp: FollowUpInfo | null };

/** A JobRow's tracking fields shaped for the cadence calculator. */
function cadenceRow(r: JobRow) {
  return {
    status: r.status as JobStatus,
    appliedAt: r.appliedAt,
    statusChangedAt: r.statusChangedAt,
    lastFollowUpAt: r.lastFollowUpAt,
    followUpCount: r.followUpCount,
  };
}

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

/** All rows needed for the cross-source dedup pass (title feeds fuzzy role matching). */
export function dedupRows(
  db: Database,
): Promise<
  Array<{ id: string; source: string; dedupKey: string; title: string; fetchedAt: Date }>
> {
  return db
    .select({
      id: jobs.id,
      source: jobs.source,
      dedupKey: jobs.dedupKey,
      title: jobs.title,
      fetchedAt: jobs.fetchedAt,
    })
    .from(jobs);
}

export async function setDuplicateOf(db: Database, id: string, canonicalId: string): Promise<void> {
  await db.update(jobs).set({ duplicateOfId: canonicalId }).where(eq(jobs.id, id));
}

/** Apply a Stage-2 JobDetail to a stored row (only the fields the detail provides). */
export async function updateJobDetail(
  db: Database,
  id: string,
  detail: {
    description?: string | null;
    employmentType?: string | null;
    seniority?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    tags?: string[] | null;
  },
): Promise<void> {
  const patch: Partial<NewJob> = {};
  if (detail.description != null) patch.description = detail.description;
  if (detail.employmentType != null) patch.employmentType = detail.employmentType;
  if (detail.seniority != null) patch.seniority = detail.seniority;
  if (detail.salaryMin != null) patch.salaryMin = detail.salaryMin;
  if (detail.salaryMax != null) patch.salaryMax = detail.salaryMax;
  if (detail.tags != null) patch.tags = detail.tags;
  if (Object.keys(patch).length === 0) return;
  await db.update(jobs).set(patch).where(eq(jobs.id, id));
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

/** Insert a source (e.g. an ATS board added from the UI). Returns undefined on slug conflict. */
export async function insertSource(
  db: Database,
  row: { slug: string; kind: string; enabled?: boolean; params?: Record<string, unknown> },
): Promise<SourceRow | undefined> {
  const [inserted] = await db
    .insert(sources)
    .values({
      slug: row.slug,
      kind: row.kind,
      enabled: row.enabled ?? true,
      params: row.params ?? {},
    })
    .onConflictDoNothing({ target: sources.slug })
    .returning();
  return inserted;
}

export async function deleteSource(db: Database, id: string): Promise<SourceRow | undefined> {
  const [row] = await db.delete(sources).where(eq(sources.id, id)).returning();
  return row;
}

export async function setLastPolled(db: Database, slug: string, at: Date): Promise<void> {
  await db.update(sources).set({ lastPolledAt: at }).where(eq(sources.slug, slug));
}

// --- Scoring & ranking ---

/** Non-duplicate jobs with no score yet (the scoring cost guard). Oldest-fetched first. */
export function unscoredJobs(db: Database, limit: number): Promise<JobRow[]> {
  return db
    .select()
    .from(jobs)
    .leftJoin(jobScores, eq(jobScores.jobId, jobs.id))
    .where(and(isNull(jobs.duplicateOfId), isNull(jobScores.id)))
    .orderBy(jobs.fetchedAt)
    .limit(limit)
    .then((rows) => rows.map((r) => r.jobs));
}

export async function insertScore(db: Database, row: NewScore): Promise<void> {
  await db.insert(jobScores).values(row).onConflictDoNothing({ target: jobScores.jobId });
}

export async function getScore(db: Database, jobId: string): Promise<ScoreRow | undefined> {
  const [row] = await db.select().from(jobScores).where(eq(jobScores.jobId, jobId)).limit(1);
  return row;
}

/**
 * Scored, non-duplicate jobs ranked by a LIVE composite (fitness × freshness-now),
 * recomputed at query time so ranking never goes stale. Newest scores are joined in.
 */
export async function listRankedJobs(
  db: Database,
  opts: { limit?: number; offset?: number } = {},
): Promise<RankedJob[]> {
  const { limit = 50, offset = 0 } = opts;
  const rows = await db
    .select({ job: jobs, score: jobScores })
    .from(jobs)
    .innerJoin(jobScores, eq(jobScores.jobId, jobs.id))
    .where(isNull(jobs.duplicateOfId));

  const now = new Date();
  return rows
    .map((r) => ({
      ...r.job,
      score: r.score,
      rank: composite(r.score.fitness, freshness(r.job.postedAt?.toISOString() ?? null, now)),
    }))
    .sort((a, b) => b.rank - a.rank)
    .slice(offset, offset + limit);
}

export interface FeedOpts {
  sort?: "recent" | "rank";
  status?: JobStatus;
  /** Case-insensitive substring match on title or company. */
  q?: string;
  /** Source slug ("remoteok") or family prefix ("greenhouse" matches "greenhouse:*"). */
  source?: string;
  /** Keep only jobs scored at or above this fitness. */
  minScore?: number;
  limit?: number;
  offset?: number;
}

/**
 * The web feed: non-duplicate jobs with their score LEFT-joined (nullable). `sort=rank`
 * keeps only scored jobs ordered by live composite; `sort=recent` keeps all, newest-first.
 * Filters by `status` (default 'new'), plus optional q/source/minScore narrowing.
 * Computed/ordered in JS so ranking is always fresh.
 */
export async function listFeed(db: Database, opts: FeedOpts = {}): Promise<FeedJob[]> {
  const { sort = "recent", status = "new", q, source, minScore, limit = 50, offset = 0 } = opts;
  const conds = [isNull(jobs.duplicateOfId), eq(jobs.status, status)];
  if (q) conds.push(or(ilike(jobs.title, `%${q}%`), ilike(jobs.company, `%${q}%`))!);
  if (source) conds.push(or(eq(jobs.source, source), like(jobs.source, `${source}:%`))!);

  const rows = await db
    .select({ job: jobs, score: jobScores })
    .from(jobs)
    .leftJoin(jobScores, eq(jobScores.jobId, jobs.id))
    .where(and(...conds));

  const now = new Date();
  let feed: FeedJob[] = rows.map((r) => ({
    ...r.job,
    score: r.score,
    rank: r.score
      ? composite(r.score.fitness, freshness(r.job.postedAt?.toISOString() ?? null, now))
      : 0,
  }));

  if (minScore != null) feed = feed.filter((j) => j.score != null && j.score.fitness >= minScore);

  if (sort === "rank") {
    feed = feed.filter((j) => j.score != null).sort((a, b) => b.rank - a.rank);
  } else {
    feed.sort((a, b) => {
      const ta = a.postedAt?.getTime() ?? 0;
      const tb = b.postedAt?.getTime() ?? 0;
      return tb - ta || b.fetchedAt.getTime() - a.fetchedAt.getTime();
    });
  }
  return feed.slice(offset, offset + limit);
}

/** Duplicate rows folded into a canonical job — "also seen on" for the detail view. */
export function listDuplicatesOf(
  db: Database,
  canonicalId: string,
): Promise<Array<{ id: string; source: string; url: string }>> {
  return db
    .select({ id: jobs.id, source: jobs.source, url: jobs.url })
    .from(jobs)
    .where(eq(jobs.duplicateOfId, canonicalId));
}

/** Header stats: per-status pipeline counts (non-duplicate), unscored backlog, overdue
 *  follow-ups, most recent poll. */
export async function feedStats(db: Database): Promise<FeedStats> {
  const byStatus = await db
    .select({ status: jobs.status, n: count() })
    .from(jobs)
    .where(isNull(jobs.duplicateOfId))
    .groupBy(jobs.status);

  const [unscored] = await db
    .select({ n: count() })
    .from(jobs)
    .leftJoin(jobScores, eq(jobScores.jobId, jobs.id))
    .where(and(isNull(jobs.duplicateOfId), isNull(jobScores.id)));

  const [poll] = await db.select({ at: max(sources.lastPolledAt) }).from(sources);
  const overdue = (await listTracking(db)).filter((j) => j.followUp?.overdue).length;

  const get = (s: JobStatus) => byStatus.find((r) => r.status === s)?.n ?? 0;
  return {
    new: get("new"),
    applied: get("applied"),
    responded: get("responded"),
    interview: get("interview"),
    offer: get("offer"),
    rejected: get("rejected"),
    discarded: get("discarded"),
    unscored: unscored?.n ?? 0,
    overdue,
    lastPolledAt: poll?.at ? poll.at.toISOString() : null,
  };
}

/** Advance a job's status; stamps `statusChangedAt`, and `appliedAt` the first time it
 *  enters `applied`. Transition legality is enforced at the route layer. */
export async function setJobStatus(
  db: Database,
  id: string,
  status: JobStatus,
): Promise<JobRow | undefined> {
  const at = new Date();
  const patch: Partial<NewJob> = { status, statusChangedAt: at };
  // Stamp appliedAt the first time the job enters `applied` (keep the original date on re-entry).
  if (status === "applied") {
    const [cur] = await db
      .select({ appliedAt: jobs.appliedAt })
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);
    if (cur && cur.appliedAt == null) patch.appliedAt = at;
  }
  const [row] = await db.update(jobs).set(patch).where(eq(jobs.id, id)).returning();
  return row;
}

/** Record a sent follow-up: bump the count + stamp `lastFollowUpAt`. */
export async function logFollowUp(db: Database, id: string): Promise<JobRow | undefined> {
  const [row] = await db
    .update(jobs)
    .set({ lastFollowUpAt: new Date(), followUpCount: sql`${jobs.followUpCount} + 1` })
    .where(eq(jobs.id, id))
    .returning();
  return row;
}

/** The tracked pipeline: engaged (non-duplicate) applications annotated with cadence,
 *  overdue first then soonest-due. */
export async function listTracking(db: Database): Promise<TrackedJob[]> {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(isNull(jobs.duplicateOfId), inArray(jobs.status, [...ACTIVE_STATUSES])));
  const now = new Date();
  return rows
    .map((r) => ({ ...r, followUp: followUpInfo(cadenceRow(r), now) }))
    .sort((a, b) => {
      const ao = a.followUp?.overdue ? 0 : 1;
      const bo = b.followUp?.overdue ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const at = a.followUp?.nextFollowUpAt ?? "9999";
      const bt = b.followUp?.nextFollowUpAt ?? "9999";
      return at.localeCompare(bt);
    });
}

/** Cadence for one job (detail view), or null for statuses without a follow-up cadence. */
export function jobFollowUp(row: JobRow, now: Date = new Date()): FollowUpInfo | null {
  return followUpInfo(cadenceRow(row), now);
}
