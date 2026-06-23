import type { MaterialKind } from "@homejobboard/shared";
import type { Database } from "../db/index.js";
import type { JobRow } from "../db/queries.js";
import { log } from "../lib/logger.js";
import { chatCompletion } from "../services/llm-client.js";
import { getSettingOr } from "../services/settings.js";
import { buildPromptFor, parseMaterial, systemPromptFor } from "./prompts.js";

/**
 * Generate a job-tailored material (CV or cover letter) as markdown. On-demand and
 * low-volume, so it uses the stronger `llm_model_materials`, with a fallback model on
 * a primary failure (a parse/validation error counts as a failure → fallback → throw).
 * Mirrors the M08 scoring call shape.
 */
export async function generateMaterial(
  db: Database,
  job: JobRow,
  kind: MaterialKind,
): Promise<{ content: string; model: string }> {
  const cv = await getSettingOr(db, "cv");
  const profile = await getSettingOr(db, "fitness_profile");
  const primary = await getSettingOr(db, "llm_model_materials");
  const fallback = await getSettingOr(db, "llm_model_materials_fallback");

  const systemPrompt = systemPromptFor(kind);
  const prompt = buildPromptFor(kind, job, cv, profile);

  try {
    const raw = await chatCompletion(prompt, { model: primary, systemPrompt });
    return { content: parseMaterial(raw), model: primary };
  } catch (err) {
    if (!fallback || fallback === primary) throw err;
    log.warn(
      {
        event: "materials.fallback",
        kind,
        primary,
        fallback,
        err: err instanceof Error ? err.message : err,
      },
      "primary material generation failed, trying fallback model",
    );
    const raw = await chatCompletion(prompt, { model: fallback, systemPrompt });
    return { content: parseMaterial(raw), model: fallback };
  }
}
