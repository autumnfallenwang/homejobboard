// The normalized Job model — the contract every source adapter maps onto.
// See docs/adr/0003-normalized-job-model-and-source-interface.md.

import { z } from "zod";

export const workplaceTypeSchema = z.enum(["remote", "hybrid", "onsite"]);
export type WorkplaceType = z.infer<typeof workplaceTypeSchema>;

// Application lifecycle status (M10). `new` = in the feed/inbox; the rest are the tracked
// pipeline; `discarded` = not pursuing (the merged feed-dismiss + tracked-then-dropped state).
// Names adopt career-ops's canonical states (ADR 0004).
export const jobStatusSchema = z.enum([
  "new",
  "applied",
  "responded",
  "interview",
  "offer",
  "rejected",
  "discarded",
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

/** The tracked pipeline — engaged applications (excludes `new`, `rejected`, `discarded`). */
export const ACTIVE_STATUSES = ["applied", "responded", "interview", "offer"] as const;

// Forward lifecycle transitions. `*→discarded` (give up) and `*→new` (reset to inbox) are
// always allowed; `canTransition` adds those plus same-status no-ops.
export const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  new: ["applied"],
  applied: ["responded", "interview", "rejected"],
  responded: ["interview", "rejected"],
  interview: ["offer", "rejected"],
  offer: ["rejected"],
  rejected: [],
  discarded: [],
};

/** Is `to` a legal next status from `from`? Reset-to-`new` and `*→discarded` are always allowed. */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  if (from === to) return true;
  if (to === "new" || to === "discarded") return true;
  return STATUS_TRANSITIONS[from].includes(to);
}

// Stage-1 output of a source adapter's `search()` — normalized listing fields.
// Clean sources (ATS, RemoteOK, …) also fill `description` here, making their
// `fetchDetail()` a no-op.
export const jobSummarySchema = z.object({
  source: z.string(),
  sourceJobId: z.string(),
  url: z.string().url(),
  applyUrl: z.string().url().nullable().optional(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable().optional(),
  workplaceType: workplaceTypeSchema.nullable().optional(),
  // ISO original-post time — the "just-listed" signal. Nullable: a few sources omit it.
  postedAt: z.string().nullable().optional(),
  salaryMin: z.number().int().nullable().optional(),
  salaryMax: z.number().int().nullable().optional(),
  employmentType: z.string().nullable().optional(),
  seniority: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  description: z.string().nullable().optional(),
});
export type JobSummary = z.infer<typeof jobSummarySchema>;

// Stage-2 output of `fetchDetail()` — the full posting enrichment.
export const jobDetailSchema = z.object({
  description: z.string().nullable(),
  salaryMin: z.number().int().nullable().optional(),
  salaryMax: z.number().int().nullable().optional(),
  employmentType: z.string().nullable().optional(),
  seniority: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});
export type JobDetail = z.infer<typeof jobDetailSchema>;

// The stored job row (summary fields + persistence/identity fields).
export const jobSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  sourceJobId: z.string(),
  url: z.string().url(),
  applyUrl: z.string().url().nullable(),
  title: z.string(),
  company: z.string(),
  location: z.string().nullable(),
  workplaceType: workplaceTypeSchema.nullable(),
  postedAt: z.string().nullable(),
  description: z.string().nullable(),
  salaryMin: z.number().int().nullable(),
  salaryMax: z.number().int().nullable(),
  employmentType: z.string().nullable(),
  seniority: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  fetchedAt: z.string(),
  dedupKey: z.string(),
  duplicateOfId: z.string().uuid().nullable(),
  status: jobStatusSchema,
  // Tracking (M10): ISO timestamps for the lifecycle + follow-up cadence.
  appliedAt: z.string().nullable(),
  statusChangedAt: z.string().nullable(),
  lastFollowUpAt: z.string().nullable(),
  followUpCount: z.number().int(),
});
export type Job = z.infer<typeof jobSchema>;

/**
 * Cross-source dedup key: `normalize(company + title + location)`.
 * Lowercased, punctuation stripped, whitespace collapsed — so the same job seen
 * on LinkedIn and an ATS collapses to one record (ADR 0003). M03's dedup reuses this.
 */
export function dedupKey(company: string, title: string, location?: string | null): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  return [norm(company), norm(title), norm(location ?? "")].join("|");
}
