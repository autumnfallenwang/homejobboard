import type { JobDetail, JobSummary, Source, SourceConfig } from "@homejobboard/shared";
import { fetchJson } from "./http.js";

interface GreenhouseJob {
  id: number;
  title: string;
  company_name?: string;
  location?: { name?: string } | null;
  absolute_url: string;
  first_published?: string | null;
  content?: string | null;
}
interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

/** Pure: map a Greenhouse board response to normalized summaries. */
export function parseGreenhouse(raw: GreenhouseResponse, company: string): JobSummary[] {
  return (raw.jobs ?? []).map((j) => ({
    source: `greenhouse:${company}`,
    sourceJobId: String(j.id),
    url: j.absolute_url,
    title: j.title,
    company: j.company_name ?? company,
    location: j.location?.name ?? null,
    postedAt: j.first_published ?? null,
    description: j.content ?? null,
  }));
}

export function greenhouseSource(config: SourceConfig): Source {
  const company = String(config.params.companyToken ?? "");
  return {
    id: config.slug,
    async search(): Promise<JobSummary[]> {
      const raw = await fetchJson<GreenhouseResponse>(
        `https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`,
      );
      return parseGreenhouse(raw, company);
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
