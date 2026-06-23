// Source adapter contract + the source-config schema.
// Selected source kinds: docs/adr/0002-job-source-access-strategy.md.

import { z } from "zod";
import type { JobFilters } from "./filters.js";
import type { JobDetail, JobSummary } from "./job.js";

// The selected access kinds (ADR 0002). Add a kind here when adding an adapter.
export const sourceKindSchema = z.enum([
  "greenhouse",
  "lever",
  "ashby",
  "workday",
  "smartrecruiters",
  "recruitee",
  "workable",
  "remoteok",
  "remotive",
  "wwr",
  "hn",
  "adzuna",
  "usajobs",
  "linkedin",
  "builtin",
  "otta",
]);
export type SourceKind = z.infer<typeof sourceKindSchema>;

// A configured source row. `slug` is the stable adapter id (e.g. "greenhouse:stripe",
// "remoteok"); `params` carries per-kind config (ATS company token, RemoteOK tag, …).
export const sourceConfigSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  kind: sourceKindSchema,
  enabled: z.boolean(),
  params: z.record(z.string(), z.unknown()),
  lastPolledAt: z.string().nullable(),
  createdAt: z.string(),
});
export type SourceConfig = z.infer<typeof sourceConfigSchema>;

export const createSourceSchema = z.object({
  slug: z.string().min(1),
  kind: sourceKindSchema,
  enabled: z.boolean().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type CreateSource = z.infer<typeof createSourceSchema>;

export const updateSourceSchema = z.object({
  enabled: z.boolean().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateSource = z.infer<typeof updateSourceSchema>;

/**
 * The two-stage source adapter interface (ADR 0003). The tier/access-method of a
 * source never leaks past its adapter.
 * - `search` (stage 1): filters in, normalized listings out.
 * - `fetchDetail` (stage 2): one listing in, full posting out — a no-op for clean
 *   sources that already returned the description in `search`.
 */
export interface Source {
  /** Stable adapter id, e.g. "greenhouse:stripe", "remoteok", "linkedin". */
  id: string;
  search(filters: JobFilters): Promise<JobSummary[]>;
  fetchDetail(summary: JobSummary): Promise<JobDetail>;
}
