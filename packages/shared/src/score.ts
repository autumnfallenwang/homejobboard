// JobScore — the LLM fitness score + composite rank for a job (computed in M04).
// See docs/adr/0003-normalized-job-model-and-source-interface.md.

import { z } from "zod";

export const jobScoreSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  // LLM-assigned personal fitness, 0–100.
  fitness: z.number().int().min(0).max(100),
  // Short bullet reasons behind the score (nullable until scored).
  reasons: z.array(z.string()).nullable(),
  // The llmgw model that produced the score.
  model: z.string(),
  // fitness × freshness — used for the ranked feed.
  composite: z.number(),
  scoredAt: z.string(),
});
export type JobScore = z.infer<typeof jobScoreSchema>;
