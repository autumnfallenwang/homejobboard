import type { JobDetail, JobSummary, Source, SourceConfig } from "@homejobboard/shared";
import { fetchJson } from "./http.js";

interface RemoteOkJob {
  id?: string;
  company?: string;
  position?: string;
  date?: string;
  location?: string;
  tags?: string[];
  url?: string;
  apply_url?: string;
  salary_min?: number;
  salary_max?: number;
  description?: string;
  // element[0] is a legal/metadata object with this field instead of a job:
  legal?: string;
}

/** Pure: map the RemoteOK `/api` array to summaries. Drops element[0] (legal notice). */
export function parseRemoteOk(raw: RemoteOkJob[]): JobSummary[] {
  return (raw ?? [])
    .filter((j): j is RemoteOkJob & { id: string } => Boolean(j.id) && !j.legal)
    .map((j) => ({
      source: "remoteok",
      sourceJobId: String(j.id),
      url: j.url ?? "",
      applyUrl: j.apply_url ?? null,
      title: j.position ?? "",
      company: j.company ?? "",
      location: j.location || null,
      workplaceType: "remote" as const,
      postedAt: j.date ?? null,
      salaryMin: j.salary_min ? j.salary_min : null,
      salaryMax: j.salary_max ? j.salary_max : null,
      tags: j.tags ?? null,
      description: j.description ?? null,
    }));
}

export function remoteOkSource(_config: SourceConfig): Source {
  return {
    id: "remoteok",
    async search(): Promise<JobSummary[]> {
      const raw = await fetchJson<RemoteOkJob[]>("https://remoteok.com/api");
      return parseRemoteOk(raw);
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
