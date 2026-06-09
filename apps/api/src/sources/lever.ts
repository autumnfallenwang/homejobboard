import type { JobDetail, JobSummary, Source, SourceConfig } from "@homejobboard/shared";
import { fetchJson } from "./http.js";

interface LeverPosting {
  id: string;
  text: string;
  categories?: { location?: string; commitment?: string } | null;
  createdAt?: number | null;
  descriptionPlain?: string | null;
  description?: string | null;
  workplaceType?: string | null;
  hostedUrl: string;
  applyUrl?: string | null;
}

/** Pure: map a Lever postings array to normalized summaries. */
export function parseLever(raw: LeverPosting[], company: string): JobSummary[] {
  return (raw ?? []).map((p) => ({
    source: `lever:${company}`,
    sourceJobId: p.id,
    url: p.hostedUrl,
    applyUrl: p.applyUrl ?? null,
    title: p.text,
    company,
    location: p.categories?.location ?? null,
    workplaceType: normalizeWorkplace(p.workplaceType),
    postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
    employmentType: p.categories?.commitment ?? null,
    description: p.descriptionPlain ?? p.description ?? null,
  }));
}

function normalizeWorkplace(w?: string | null): JobSummary["workplaceType"] {
  if (w === "remote" || w === "hybrid" || w === "onsite") return w;
  return null;
}

export function leverSource(config: SourceConfig): Source {
  const company = String(config.params.companyToken ?? "");
  return {
    id: config.slug,
    async search(): Promise<JobSummary[]> {
      const raw = await fetchJson<LeverPosting[]>(
        `https://api.lever.co/v0/postings/${company}?mode=json`,
      );
      return parseLever(raw, company);
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
