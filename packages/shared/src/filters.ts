// JobFilters — the cross-source filter config. Each adapter translates these into
// its own query (LinkedIn f_*, Adzuna params, ATS = client-side, …); the ingestion
// pipeline then applies `matchesFilters` client-side so every source honors them.

import { z } from "zod";
import type { JobSummary } from "./job.js";
import { workplaceTypeSchema } from "./job.js";

export const jobFiltersSchema = z.object({
  keywords: z.array(z.string()).default([]),
  // Hard excludes (dealbreakers): a hit in title/company/tags drops the job.
  excludeKeywords: z.array(z.string()).default([]),
  location: z.string().optional(),
  workplaceType: workplaceTypeSchema.optional(),
  seniority: z.string().optional(),
  // Coarse "posted within" window, e.g. "1h", "24h", "7d". Adapters that support a
  // server-side window pass it through; others diff client-side on postedAt.
  postedSince: z.string().optional(),
  // Restrict the poll to a subset of source slugs; omit = all enabled sources.
  sources: z.array(z.string()).optional(),
});
export type JobFilters = z.infer<typeof jobFiltersSchema>;

/** Parse a "30m" / "24h" / "7d" window into milliseconds; null when absent/invalid. */
export function parsePostedSince(window: string | undefined): number | null {
  const m = window?.match(/^(\d+)\s*([mhd])$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = { m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2]!.toLowerCase() as "m" | "h" | "d"];
  return n * unit;
}

const hasTerm = (haystack: string, terms: string[]) =>
  terms.some((t) => t.trim() && haystack.includes(t.trim().toLowerCase()));

/**
 * Client-side filter pass, applied to every source's results before storing
 * (ADR 0003: "new + filter-passing only" get scored). Unknown job fields never
 * disqualify — a null location/postedAt/workplaceType passes, so sources with
 * sparse metadata aren't silently dropped; the LLM scorer is the precise judge.
 *
 * - `keywords`: at least one must appear in title/company/tags/description.
 * - `excludeKeywords`: a hit in title/company/tags drops the job (description is
 *   skipped — "no crypto experience needed" shouldn't trip a "crypto" exclude).
 * - `location`: substring match; remote jobs pass regardless of location.
 * - `workplaceType`: exact match when the job declares one.
 * - `postedSince`: postedAt must fall inside the window.
 */
export function matchesFilters(
  job: Pick<
    JobSummary,
    "title" | "company" | "location" | "workplaceType" | "postedAt" | "tags" | "description"
  >,
  filters: JobFilters,
  now: Date = new Date(),
): boolean {
  const title = job.title.toLowerCase();
  const company = job.company.toLowerCase();
  const tags = (job.tags ?? []).join(" ").toLowerCase();
  const head = `${title} ${company} ${tags}`;

  if (filters.excludeKeywords.length && hasTerm(head, filters.excludeKeywords)) return false;

  if (filters.keywords.length) {
    const full = `${head} ${(job.description ?? "").toLowerCase()}`;
    if (!hasTerm(full, filters.keywords)) return false;
  }

  if (filters.location && job.location && job.workplaceType !== "remote") {
    if (!job.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
  }

  if (filters.workplaceType && job.workplaceType && job.workplaceType !== filters.workplaceType) {
    return false;
  }

  const windowMs = parsePostedSince(filters.postedSince);
  if (windowMs != null && job.postedAt) {
    if (now.getTime() - new Date(job.postedAt).getTime() > windowMs) return false;
  }

  return true;
}
