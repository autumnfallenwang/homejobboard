import { composite, freshness } from "@homejobboard/shared";
import type { Database } from "../db/index.js";
import { insertScore, type JobRow, unscoredJobs } from "../db/queries.js";
import { log } from "../lib/logger.js";
import {
  buildFitnessPrompt,
  FITNESS_SYSTEM_PROMPT,
  type FitnessResult,
  parseFitnessVerdict,
} from "../scoring/rubric.js";
import { chatCompletion } from "./llm-client.js";
import { getSettingOr } from "./settings.js";

/** Score one job against the stored profile, with a fallback model on primary failure
 *  (a parse/validation error counts as a failure → fallback → fail closed). */
export async function scoreJob(
  db: Database,
  job: JobRow,
): Promise<FitnessResult & { model: string }> {
  const profile = await getSettingOr(db, "fitness_profile");
  const primary = await getSettingOr(db, "llm_model_fitness");
  const fallback = await getSettingOr(db, "llm_model_fitness_fallback");
  const prompt = buildFitnessPrompt(job, profile);

  try {
    const raw = await chatCompletion(prompt, {
      model: primary,
      systemPrompt: FITNESS_SYSTEM_PROMPT,
    });
    return { ...parseFitnessVerdict(raw), model: primary };
  } catch (err) {
    if (!fallback || fallback === primary) throw err;
    log.warn(
      { event: "score.fallback", primary, fallback, err: err instanceof Error ? err.message : err },
      "primary scoring failed, trying fallback model",
    );
    const raw = await chatCompletion(prompt, {
      model: fallback,
      systemPrompt: FITNESS_SYSTEM_PROMPT,
    });
    return { ...parseFitnessVerdict(raw), model: fallback };
  }
}

export interface ScoreSummary {
  scored: number;
  errors: number;
}

/**
 * Score unscored, non-duplicate jobs (cost guard). Sequential, per-job error
 * isolation. `limit` defaults to the `score_batch_size` setting.
 */
export async function scoreUnscoredJobs(db: Database, limit?: number): Promise<ScoreSummary> {
  const batch = limit ?? (Number(await getSettingOr(db, "score_batch_size")) || 50);
  const jobs = await unscoredJobs(db, batch);
  const now = new Date();
  let scored = 0;
  let errors = 0;

  for (const job of jobs) {
    try {
      const { fitness, verdict, model } = await scoreJob(db, job);
      const fresh = freshness(job.postedAt ? job.postedAt.toISOString() : null, now);
      // Back-compat: keep `reasons` populated from the verdict (top strengths, else rationale).
      const reasons = verdict.topStrengths.length ? verdict.topStrengths : [verdict.rationale];
      await insertScore(db, {
        jobId: job.id,
        fitness,
        verdict,
        reasons,
        model,
        composite: composite(fitness, fresh),
      });
      scored++;
    } catch (err) {
      errors++;
      log.warn(
        { event: "score.job.failed", jobId: job.id, err: err instanceof Error ? err.message : err },
        "scoring a job failed",
      );
    }
  }

  log.info({ event: "score.done", scored, errors }, "scoring pass complete");
  return { scored, errors };
}
