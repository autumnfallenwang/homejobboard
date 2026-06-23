// Follow-up cadence contract (M10) — the shape the API attaches to tracked jobs and
// the web renders. The cadence *math* lives server-side (apps/api/src/tracking/cadence.ts);
// this is just the result type shared across the boundary.

import { z } from "zod";

export const urgencySchema = z.enum(["waiting", "urgent", "overdue", "cold"]);
export type Urgency = z.infer<typeof urgencySchema>;

export const followUpInfoSchema = z.object({
  nextFollowUpAt: z.string().nullable(), // ISO date, or null when no further follow-up is warranted
  urgency: urgencySchema,
  overdue: z.boolean(),
});
export type FollowUpInfo = z.infer<typeof followUpInfoSchema>;
