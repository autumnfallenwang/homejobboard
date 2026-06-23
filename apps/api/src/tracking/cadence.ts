import type { FollowUpInfo, JobStatus, Urgency } from "@homejobboard/shared";

// Follow-up cadence — pure logic ported from career-ops (MIT) `followup-cadence.mjs`
// (the markdown-file parsing is dropped; we feed it DB-row fields). Computes, per
// tracked application, when the next follow-up is due and whether it's overdue.
// Only `applied`, `responded`, and `interview` have a cadence.

export const DEFAULT_CADENCE = {
  applied_first: 7,
  applied_subsequent: 7,
  applied_max_followups: 2,
  responded_initial: 1,
  responded_subsequent: 3,
  interview_thankyou: 1,
} as const;

const DAY_MS = 86_400_000;

/** Whole days from `a` to `b` (floored). */
export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / DAY_MS);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Ported: urgency label from status + elapsed days + follow-up count. */
export function computeUrgency(
  status: JobStatus,
  daysSinceRef: number,
  daysSinceLastFollowUp: number | null,
  followUpCount: number,
): Urgency {
  const c = DEFAULT_CADENCE;
  if (status === "applied") {
    if (followUpCount >= c.applied_max_followups) return "cold";
    if (followUpCount === 0 && daysSinceRef >= c.applied_first) return "overdue";
    if (
      followUpCount > 0 &&
      daysSinceLastFollowUp !== null &&
      daysSinceLastFollowUp >= c.applied_subsequent
    ) {
      return "overdue";
    }
    return "waiting";
  }
  if (status === "responded") {
    if (daysSinceRef < c.responded_initial) return "urgent";
    if (daysSinceRef >= c.responded_subsequent) return "overdue";
    return "waiting";
  }
  if (status === "interview") {
    if (daysSinceRef >= c.interview_thankyou) return "overdue";
    return "waiting";
  }
  return "waiting";
}

/** Ported: the next follow-up due-date, or null when no further follow-up is warranted. */
export function computeNextFollowUpAt(
  status: JobStatus,
  refDate: Date,
  lastFollowUpAt: Date | null,
  followUpCount: number,
): Date | null {
  const c = DEFAULT_CADENCE;
  if (status === "applied") {
    if (followUpCount >= c.applied_max_followups) return null; // cold
    if (followUpCount === 0) return addDays(refDate, c.applied_first);
    if (lastFollowUpAt) return addDays(lastFollowUpAt, c.applied_subsequent);
    return addDays(refDate, c.applied_first);
  }
  if (status === "responded") {
    if (lastFollowUpAt) return addDays(lastFollowUpAt, c.responded_subsequent);
    return addDays(refDate, c.responded_subsequent);
  }
  if (status === "interview") {
    return addDays(refDate, c.interview_thankyou);
  }
  return null;
}

export interface CadenceRow {
  status: JobStatus;
  appliedAt: Date | null;
  statusChangedAt: Date | null;
  lastFollowUpAt: Date | null;
  followUpCount: number;
}

/**
 * Cadence for one tracked application, or null for statuses without a follow-up
 * cadence. Reference date is `appliedAt` for `applied`, else the time the current
 * status was entered (`statusChangedAt`).
 */
export function followUpInfo(row: CadenceRow, now: Date): FollowUpInfo | null {
  const ref =
    row.status === "applied"
      ? row.appliedAt
      : row.status === "responded" || row.status === "interview"
        ? (row.statusChangedAt ?? row.appliedAt)
        : null;
  if (!ref) return null;

  const daysSinceRef = daysBetween(ref, now);
  const daysSinceLast = row.lastFollowUpAt ? daysBetween(row.lastFollowUpAt, now) : null;
  const urgency = computeUrgency(row.status, daysSinceRef, daysSinceLast, row.followUpCount);
  const next = computeNextFollowUpAt(row.status, ref, row.lastFollowUpAt, row.followUpCount);
  return {
    nextFollowUpAt: next ? next.toISOString() : null,
    urgency,
    overdue: urgency === "overdue",
  };
}
