// Header/feed stats — the API↔web contract for the dashboard counts. Per-status
// pipeline counts + unscored backlog + overdue follow-ups + last poll time (M10).

import { z } from "zod";

export const feedStatsSchema = z.object({
  new: z.number().int(),
  applied: z.number().int(),
  responded: z.number().int(),
  interview: z.number().int(),
  offer: z.number().int(),
  rejected: z.number().int(),
  discarded: z.number().int(),
  unscored: z.number().int(),
  overdue: z.number().int(), // tracked applications with an overdue follow-up
  lastPolledAt: z.string().nullable(),
});
export type FeedStats = z.infer<typeof feedStatsSchema>;
