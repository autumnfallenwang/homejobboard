import { type FitnessVerdict, fitnessVerdictSchema } from "@homejobboard/shared";
import type { JobRow } from "../db/queries.js";

// The fitness-scoring rubric: prompt + parser. Adapted (trimmed) from career-ops's
// `modes/oferta.md` "Machine Summary" (MIT) — stripped of its report/tracker/PDF/CV
// framing, keeping the structured verdict our no-CV, job+profile scoring can produce.
// One cheap llmgw call returns a holistic `fitness` (0–100, the sort/filter score) plus
// the structured `verdict`. Validation is Zod at the boundary (see parseFitnessVerdict).

export const FITNESS_SYSTEM_PROMPT = `You evaluate how well a single job matches a candidate's fitness profile.

Return ONLY a JSON object (no prose, no markdown fences) of this exact shape:
{
  "fitness": <integer 0-100>,
  "verdict": {
    "recommendation": "apply" | "consider" | "research" | "skip",
    "subScores": {
      "skills": <0-5>, "seniority": <0-5>, "domain": <0-5>,
      "compensation": <0-5>, "logistics": <0-5>
    },
    "topStrengths": [<up to 5 short strings>],
    "hardStops": [<up to 5 short strings>],
    "softGaps": [<up to 5 short strings>],
    "rationale": "<one sentence, <= 300 chars>",
    "confidence": "low" | "medium" | "high"
  }
}

Scoring guide:
- fitness: holistic 0-100 (0 = terrible, 100 = perfect). This is the headline score.
- subScores (each 0-5):
  - skills: the role's required stack/skills vs the profile's strengths.
  - seniority: the role's level vs the target seniority.
  - domain: the role's industry/problem domain vs stated interests.
  - compensation: stated comp vs the target range. Use 3 (neutral) when no comp is given.
  - logistics: location / workplace type / visa / employment type vs constraints and dealbreakers.
- recommendation:
  - "apply": strong match, no hard stops.
  - "consider": good match with caveats.
  - "research": promising but key info is missing.
  - "skip": a hard stop is hit, or the match is weak.
- hardStops: dealbreaker violations or blocking gaps (empty array if none).
- softGaps: non-blocking gaps worth noting (empty array if none).
- topStrengths: the strengths most relevant to THIS role (empty array if none).
- confidence: how complete the available data is (a thin posting => "low").

Rules: never invent facts not present in the profile or posting; keep every string terse;
use [] for empty lists; output the JSON object and nothing else.`;

/** Build the user prompt from the free-text profile + the job (description capped). */
export function buildFitnessPrompt(job: JobRow, profile: string): string {
  const parts = [
    `Candidate fitness profile:\n${profile}`,
    "\n---\nJob:",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    job.location ? `Location: ${job.location}` : null,
    job.workplaceType ? `Workplace: ${job.workplaceType}` : null,
    job.employmentType ? `Type: ${job.employmentType}` : null,
    job.salaryMin || job.salaryMax
      ? `Salary: ${job.salaryMin ?? "?"}–${job.salaryMax ?? "?"}`
      : null,
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

export interface FitnessResult {
  fitness: number;
  verdict: FitnessVerdict;
}

/**
 * Validate + coerce the LLM output into a `{ fitness, verdict }`. Throws on a bad
 * `fitness` or a verdict that fails the Zod schema — the throw flows into the
 * caller's primary→fallback retry, then per-job error isolation (fails closed).
 */
export function parseFitnessVerdict(raw: string): FitnessResult {
  const obj = extractJson(raw) as Record<string, unknown>;
  const fitness = obj.fitness;
  if (typeof fitness !== "number" || fitness < 0 || fitness > 100) {
    throw new Error(`invalid fitness: ${String(fitness)}`);
  }
  const verdict = fitnessVerdictSchema.parse(obj.verdict);
  return { fitness: Math.round(fitness), verdict };
}
