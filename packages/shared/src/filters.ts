// JobFilters — the cross-source filter config. Each adapter translates these into
// its own query (LinkedIn f_*, Adzuna params, ATS = client-side, …).
//
// v1 shape — fields may be tuned once filters are actually exercised (M03/M05).

import { z } from "zod";
import { workplaceTypeSchema } from "./job.js";

export const jobFiltersSchema = z.object({
  keywords: z.array(z.string()).default([]),
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
