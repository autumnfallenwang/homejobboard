// JobScore — the LLM fitness score + composite rank for a job (computed in M04).
// See docs/adr/0003-normalized-job-model-and-source-interface.md.

import { z } from "zod";

// --- Ranking helpers (pure; shared by api + web) ---

const FRESHNESS_HALF_LIFE_DAYS = 7;

/**
 * Recency weight in (0, 1]: 1 at age 0, halving every ~7 days. A null/absent
 * postedAt gets a neutral 0.5 (we can't tell how fresh it is).
 */
export function freshness(postedAt: string | null | undefined, now: Date = new Date()): number {
  if (!postedAt) return 0.5;
  const ageMs = now.getTime() - new Date(postedAt).getTime();
  const ageDays = Math.max(0, ageMs / 86_400_000);
  return 0.5 ** (ageDays / FRESHNESS_HALF_LIFE_DAYS);
}

/** Composite rank = fitness (0–100) × freshness (0–1). */
export function composite(fitness: number, fresh: number): number {
  return fitness * fresh;
}

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
