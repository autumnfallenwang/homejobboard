import type {
  JobDetail,
  JobSummary,
  Source,
  SourceConfig,
  WorkplaceType,
} from "@homejobboard/shared";
import { fetchJson } from "./http.js";

// Ashby public job-posting API (zero-auth, documented): one request returns every
// published posting for a company, descriptions inline, compensation with
// ?includeCompensation=true. Per-company like the other ATS adapters.

interface AshbyCompComponent {
  compensationType?: string;
  minValue?: number | null;
  maxValue?: number | null;
}
interface AshbyJob {
  id: string;
  title: string;
  department?: string | null;
  team?: string | null;
  employmentType?: string | null;
  location?: string | null;
  publishedAt?: string | null;
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  jobUrl?: string;
  applyUrl?: string | null;
  descriptionHtml?: string | null;
  descriptionPlain?: string | null;
  compensation?: { summaryComponents?: AshbyCompComponent[] | null } | null;
}
interface AshbyResponse {
  jobs: AshbyJob[];
}

const WORKPLACE: Record<string, WorkplaceType> = {
  remote: "remote",
  hybrid: "hybrid",
  onsite: "onsite",
};

/** Pure: map an Ashby job-board response to normalized summaries (unlisted dropped). */
export function parseAshby(raw: AshbyResponse, company: string): JobSummary[] {
  return (raw.jobs ?? [])
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const salary = j.compensation?.summaryComponents?.find(
        (c) => c.compensationType === "Salary",
      );
      const wt = (j.workplaceType ?? "").toLowerCase().replace(/[^a-z]/g, "");
      const tags = [...new Set([j.department, j.team].filter((t): t is string => Boolean(t)))];
      return {
        source: `ashby:${company}`,
        sourceJobId: j.id,
        url: j.jobUrl ?? `https://jobs.ashbyhq.com/${company}/${j.id}`,
        applyUrl: j.applyUrl ?? null,
        title: j.title,
        company,
        location: j.location ?? null,
        workplaceType: WORKPLACE[wt] ?? (j.isRemote ? ("remote" as const) : null),
        postedAt: j.publishedAt ?? null,
        salaryMin: salary?.minValue != null ? Math.round(salary.minValue) : null,
        salaryMax: salary?.maxValue != null ? Math.round(salary.maxValue) : null,
        employmentType: j.employmentType ?? null,
        tags: tags.length ? tags : null,
        description: j.descriptionHtml ?? j.descriptionPlain ?? null,
      };
    });
}

export function ashbySource(config: SourceConfig): Source {
  const company = String(config.params.companyToken ?? "");
  return {
    id: config.slug,
    async search(): Promise<JobSummary[]> {
      const raw = await fetchJson<AshbyResponse>(
        `https://api.ashbyhq.com/posting-api/job-board/${company}?includeCompensation=true`,
      );
      return parseAshby(raw, company);
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
