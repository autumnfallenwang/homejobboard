import { composite, freshness } from "@homejobboard/shared";
import type { Database } from "../db/index.js";
import { insertScore, type JobRow, unscoredJobs } from "../db/queries.js";
import { log } from "../lib/logger.js";
import { chatCompletion } from "./llm-client.js";
import { getSettingOr } from "./settings.js";

const SYSTEM_PROMPT =
  "You score how well a job matches a candidate's fitness profile. " +
  'Respond ONLY with valid JSON: {"fitness": <integer 0-100>, "reasons": [<up to 4 short strings>]}. ' +
  "fitness 0 = terrible match, 100 = perfect. Consider role, stack, seniority, location/remote, and dealbreakers.";

export interface FitnessResult {
  fitness: number;
  reasons: string[];
}

/** Build the user prompt from the profile + the job (description capped). */
export function buildFitnessPrompt(job: JobRow, profile: string): string {
  const parts = [
    `Candidate fitness profile:\n${profile}`,
    "\n---\nJob:",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    job.location ? `Location: ${job.location}` : null,
    job.workplaceType ? `Workplace: ${job.workplaceType}` : null,
    job.employmentType ? `Type: ${job.employmentType}` : null,
    job.description ? `Description: ${job.description.slice(0, 2500)}` : null,
  ].filter(Boolean);
  return parts.join("\n");
}

/** Pull the first {...} JSON object out of a (possibly markdown-wrapped) response. */
function extractJson(raw: string): unknown {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("no JSON object in LLM response");
  return JSON.parse(m[0]);
}

/** Validate + coerce the LLM output into a FitnessResult (throws on bad fitness). */
export function parseFitnessResult(raw: string): FitnessResult {
  const obj = extractJson(raw) as Record<string, unknown>;
  const fitness = obj.fitness;
  if (typeof fitness !== "number" || fitness < 0 || fitness > 100) {
    throw new Error(`invalid fitness: ${String(fitness)}`);
  }
  const reasons = Array.isArray(obj.reasons) ? obj.reasons.slice(0, 4).map(String) : [];
  return { fitness: Math.round(fitness), reasons };
}

/** Score one job against the stored profile, with a fallback model on primary failure. */
export async function scoreJob(
  db: Database,
  job: JobRow,
): Promise<FitnessResult & { model: string }> {
  const profile = await getSettingOr(db, "fitness_profile");
  const primary = await getSettingOr(db, "llm_model_fitness");
  const fallback = await getSettingOr(db, "llm_model_fitness_fallback");
  const prompt = buildFitnessPrompt(job, profile);

  try {
    const raw = await chatCompletion(prompt, { model: primary, systemPrompt: SYSTEM_PROMPT });
    return { ...parseFitnessResult(raw), model: primary };
  } catch (err) {
    if (!fallback || fallback === primary) throw err;
    log.warn(
      { event: "score.fallback", primary, fallback, err: err instanceof Error ? err.message : err },
      "primary scoring failed, trying fallback model",
    );
    const raw = await chatCompletion(prompt, { model: fallback, systemPrompt: SYSTEM_PROMPT });
    return { ...parseFitnessResult(raw), model: fallback };
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
      const result = await scoreJob(db, job);
      const fresh = freshness(job.postedAt ? job.postedAt.toISOString() : null, now);
      await insertScore(db, {
        jobId: job.id,
        fitness: result.fitness,
        reasons: result.reasons.length ? result.reasons : null,
        model: result.model,
        composite: composite(result.fitness, fresh),
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
