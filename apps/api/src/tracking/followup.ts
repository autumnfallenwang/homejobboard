import type { Database } from "../db/index.js";
import type { JobRow } from "../db/queries.js";
import { log } from "../lib/logger.js";
import { parseMaterial } from "../materials/prompts.js";
import { chatCompletion } from "../services/llm-client.js";
import { getSettingOr } from "../services/settings.js";
import { daysBetween } from "./cadence.js";

// Follow-up message drafting (M10). Guardrails adapted from career-ops (MIT)
// `modes/followup.md`. One on-demand llmgw call → an editable markdown draft; never
// auto-sent. Reuses the strong materials model + the primary→fallback shape (M09).

export const FOLLOWUP_SYSTEM_PROMPT = `You draft a short, specific follow-up message for a job
application the candidate has already submitted. Output GitHub-flavored markdown only (a "Subject:"
line, then 3-4 short sentences, <= 150 words total):
- Reference the exact role + company and roughly when the application went in.
- Lead with ONE concrete, CV-grounded value-add (a metric, system, or outcome from the candidate's
  CV) — not a restatement of interest.
- A soft ask with a specific availability window ("this week", "next Tuesday").
- Warm but professional. Active voice.
Banned phrases: "just checking in", "circling back", "touching base", "I wanted to reach out",
"following up on my application" as the opener. For a SECOND follow-up, take a fresh angle (a new
proof point) and keep it shorter. HARD RULE: invent nothing not in the candidate's CV.`;

export interface FollowUpContext {
  status: string;
  daysSinceApplied: number | null;
  followUpCount: number;
}

export function buildFollowUpPrompt(
  job: JobRow,
  cv: string,
  profile: string,
  ctx: FollowUpContext,
): string {
  return [
    `Candidate CV (the only source of truth for facts):\n${cv}`,
    `\nCandidate preferences (tone/targeting):\n${profile}`,
    "\n---\nApplication:",
    `Role: ${job.title}`,
    `Company: ${job.company}`,
    `Current status: ${ctx.status}`,
    ctx.daysSinceApplied != null ? `Days since applied: ${ctx.daysSinceApplied}` : null,
    `Follow-ups already sent: ${ctx.followUpCount}`,
    job.description ? `\nJob description:\n${job.description.slice(0, 2000)}` : null,
    "\n---\nReturn the follow-up message as markdown.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Draft a follow-up for one application, strong model with a fallback (mirrors M09). */
export async function generateFollowUp(
  db: Database,
  job: JobRow,
): Promise<{ content: string; model: string }> {
  const cv = await getSettingOr(db, "cv");
  const profile = await getSettingOr(db, "fitness_profile");
  const primary = await getSettingOr(db, "llm_model_materials");
  const fallback = await getSettingOr(db, "llm_model_materials_fallback");

  const ctx: FollowUpContext = {
    status: job.status,
    daysSinceApplied: job.appliedAt ? daysBetween(job.appliedAt, new Date()) : null,
    followUpCount: job.followUpCount,
  };
  const prompt = buildFollowUpPrompt(job, cv, profile, ctx);

  try {
    const raw = await chatCompletion(prompt, {
      model: primary,
      systemPrompt: FOLLOWUP_SYSTEM_PROMPT,
    });
    return { content: parseMaterial(raw), model: primary };
  } catch (err) {
    if (!fallback || fallback === primary) throw err;
    log.warn(
      {
        event: "followup.fallback",
        primary,
        fallback,
        err: err instanceof Error ? err.message : err,
      },
      "primary follow-up draft failed, trying fallback model",
    );
    const raw = await chatCompletion(prompt, {
      model: fallback,
      systemPrompt: FOLLOWUP_SYSTEM_PROMPT,
    });
    return { content: parseMaterial(raw), model: fallback };
  }
}
