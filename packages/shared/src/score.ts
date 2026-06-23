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

// --- Structured fitness verdict (M08) ---
// The rubric output that enriches the bare `fitness` number: a recommendation, a
// sub-score breakdown, and the strengths / hard-stops / gaps that explain it.
// Ported (trimmed) from career-ops's `oferta.md` Machine Summary (MIT).

export const fitnessRecommendationSchema = z.enum(["apply", "consider", "research", "skip"]);
export type FitnessRecommendation = z.infer<typeof fitnessRecommendationSchema>;

export const fitnessConfidenceSchema = z.enum(["low", "medium", "high"]);
export type FitnessConfidence = z.infer<typeof fitnessConfidenceSchema>;

const subScore = () => z.number().int().min(0).max(5);

/** Per-dimension 0–5 breakdown (trimmed to our no-CV, job+profile context). */
export const fitnessSubScoresSchema = z.object({
  skills: subScore(), // role stack/skills vs profile strengths
  seniority: subScore(), // role level vs target seniority
  domain: subScore(), // industry/problem domain vs interests
  compensation: subScore(), // stated comp vs target (neutral 3 when unknown)
  logistics: subScore(), // location/workplace/visa/type vs constraints + dealbreakers
});
export type FitnessSubScores = z.infer<typeof fitnessSubScoresSchema>;

export const fitnessVerdictSchema = z.object({
  recommendation: fitnessRecommendationSchema,
  subScores: fitnessSubScoresSchema,
  topStrengths: z.array(z.string()).max(5),
  hardStops: z.array(z.string()).max(5), // dealbreaker violations / blocking gaps
  softGaps: z.array(z.string()).max(5), // non-blocking gaps
  rationale: z.string().max(400),
  confidence: fitnessConfidenceSchema,
});
export type FitnessVerdict = z.infer<typeof fitnessVerdictSchema>;

export const jobScoreSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().uuid(),
  // LLM-assigned personal fitness, 0–100. Stays the canonical sort/filter score.
  fitness: z.number().int().min(0).max(100),
  // Short bullet reasons behind the score (nullable until scored). Back-compat;
  // populated from the verdict's strengths/rationale.
  reasons: z.array(z.string()).nullable(),
  // The structured rubric verdict (null on pre-M08 rows).
  verdict: fitnessVerdictSchema.nullable(),
  // The llmgw model that produced the score.
  model: z.string(),
  // fitness × freshness — used for the ranked feed.
  composite: z.number(),
  scoredAt: z.string(),
});
export type JobScore = z.infer<typeof jobScoreSchema>;
