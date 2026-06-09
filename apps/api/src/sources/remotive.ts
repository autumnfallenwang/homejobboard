import type { JobDetail, JobSummary, Source, SourceConfig } from "@homejobboard/shared";
import { fetchJson } from "./http.js";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  description?: string;
}
interface RemotiveResponse {
  jobs: RemotiveJob[];
}

/** Pure: map a Remotive `/api/remote-jobs` response to summaries. */
export function parseRemotive(raw: RemotiveResponse): JobSummary[] {
  return (raw.jobs ?? []).map((j) => ({
    source: "remotive",
    sourceJobId: String(j.id),
    url: j.url,
    title: j.title,
    company: j.company_name ?? "",
    location: j.candidate_required_location || null,
    workplaceType: "remote" as const,
    postedAt: j.publication_date ?? null,
    employmentType: j.job_type ?? null,
    tags: j.tags ?? null,
    description: j.description ?? null,
  }));
}

export function remotiveSource(_config: SourceConfig): Source {
  return {
    id: "remotive",
    async search(): Promise<JobSummary[]> {
      const raw = await fetchJson<RemotiveResponse>("https://remotive.com/api/remote-jobs");
      return parseRemotive(raw);
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
