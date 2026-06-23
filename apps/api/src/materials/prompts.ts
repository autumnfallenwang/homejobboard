import type { MaterialKind } from "@homejobboard/shared";
import type { JobRow } from "../db/queries.js";

// Prompts for per-job application materials (M09). Adapted from career-ops (MIT)
// `modes/cover.md` guardrails. Both emit **markdown only** (the web renders it to
// ATS-clean, print-styled HTML). The hard rule across both: never invent experience,
// employers, or metrics that aren't in the candidate's CV.

const NO_FABRICATION =
  "HARD RULE: use only facts, employers, dates, and metrics that appear in the candidate's CV " +
  "below. Never invent or inflate experience, numbers, or skills. If the CV lacks something the " +
  "job wants, omit it — do not fabricate it. Output GitHub-flavored markdown only (no code fences, " +
  "no preamble, no closing remarks about the document).";

export const CV_TAILOR_SYSTEM_PROMPT = `You tailor a candidate's existing CV to one specific job.
Re-order and re-emphasize the candidate's REAL experience to foreground what this job values; mirror
the job's vocabulary only where it honestly applies. Keep it ATS-clean: plain markdown, '##' section
headings, '-' bullets, no tables, no images. Lead with the candidate name as a '# ' heading, then a
short summary, then the most relevant experience. ${NO_FABRICATION}`;

export const COVER_SYSTEM_PROMPT = `You write a focused cover letter for one specific job, grounded
in the candidate's CV. Structure: a '# ' name heading, a one-line role/company line, then 3-4 short
body paragraphs (a concrete opening, a profile paragraph, the problems you'd help solve, a brief
availability close). 320-420 words of body. Active voice. Every claim needs a number, system, or
specific outcome drawn from the CV. Banned words: leverage, synergy, seamless, holistic, robust,
cutting-edge, spearheaded, passionate, excited, stakeholder alignment, data-driven, move the needle,
perfect fit, strong track record. No filler openers ("I am writing to", "I am excited to"). Use '-'
for any bullets. ${NO_FABRICATION}`;

function jobBlock(job: JobRow): string {
  return [
    "Job:",
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    job.location ? `Location: ${job.location}` : null,
    job.workplaceType ? `Workplace: ${job.workplaceType}` : null,
    job.employmentType ? `Type: ${job.employmentType}` : null,
    job.description ? `Description: ${job.description.slice(0, 3000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildCvPrompt(job: JobRow, cv: string, profile: string): string {
  return [
    `Candidate CV (the only source of truth for facts):\n${cv}`,
    `\nCandidate preferences (for emphasis, not facts):\n${profile}`,
    `\n---\n${jobBlock(job)}`,
    "\n---\nReturn the tailored CV as markdown.",
  ].join("\n");
}

export function buildCoverPrompt(job: JobRow, cv: string, profile: string): string {
  return [
    `Candidate CV (the only source of truth for facts):\n${cv}`,
    `\nCandidate preferences (tone/targeting):\n${profile}`,
    `\n---\n${jobBlock(job)}`,
    "\n---\nReturn the cover letter as markdown.",
  ].join("\n");
}

export function systemPromptFor(kind: MaterialKind): string {
  return kind === "cv" ? CV_TAILOR_SYSTEM_PROMPT : COVER_SYSTEM_PROMPT;
}

export function buildPromptFor(
  kind: MaterialKind,
  job: JobRow,
  cv: string,
  profile: string,
): string {
  return kind === "cv" ? buildCvPrompt(job, cv, profile) : buildCoverPrompt(job, cv, profile);
}

/** Trim the LLM reply; throw on an empty/whitespace response (→ triggers the fallback model). */
export function parseMaterial(raw: string): string {
  const content = raw.trim();
  if (!content) throw new Error("empty material from LLM");
  return content;
}
