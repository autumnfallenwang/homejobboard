import type { JobDetail, JobSummary, Source, SourceConfig } from "@homejobboard/shared";
import { fetchJson } from "./http.js";

// SmartRecruiters — public postings API (zero-auth). Endpoint + parsing ported
// from career-ops (MIT) `providers/smartrecruiters.mjs`. Per-company by slug:
// `api.smartrecruiters.com/v1/companies/<slug>/postings`. The list does not carry
// the full description, so fetchDetail stays a no-op (scoring runs on title/company/location).

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap — 5000 postings @ 100/page

interface SmartRecruitersLocation {
  fullLocation?: string;
  city?: string;
  region?: string;
  country?: string;
  remote?: boolean;
}
interface SmartRecruitersPosting {
  id?: string;
  name?: string;
  ref?: string;
  releasedDate?: string;
  createdOn?: string;
  location?: SmartRecruitersLocation;
}
interface SmartRecruitersResponse {
  content?: SmartRecruitersPosting[];
}

function postingsUrl(slug: string, offset: number): string {
  return `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${PAGE_SIZE}&offset=${offset}&status=PUBLIC`;
}

/** `api.smartrecruiters.com/v1/companies/<slug>/postings/<id>` → public `jobs.smartrecruiters.com/<slug>/postings/<id>`. */
function publicUrl(ref: string | undefined, slug: string, id: string | undefined): string {
  if (typeof ref === "string") {
    try {
      const parsed = new URL(ref);
      if (
        parsed.protocol === "https:" &&
        parsed.hostname === "api.smartrecruiters.com" &&
        parsed.pathname.startsWith("/v1/companies/")
      ) {
        return `https://jobs.smartrecruiters.com/${parsed.pathname.slice("/v1/companies/".length)}`;
      }
    } catch {
      // fall through to synthesized URL
    }
  }
  return id ? `https://jobs.smartrecruiters.com/${slug}/${id}` : "";
}

/** Pure: map a SmartRecruiters /postings response to normalized summaries. */
export function parseSmartRecruiters(
  raw: SmartRecruitersResponse,
  slug: string,
  company: string,
): JobSummary[] {
  return (raw.content ?? [])
    .map((j) => {
      const loc = j.location ?? {};
      const full =
        loc.fullLocation || [loc.city, loc.region, loc.country].filter(Boolean).join(", ");
      const location = [full, loc.remote ? "Remote" : ""].filter(Boolean).join(", ") || null;
      return {
        source: `smartrecruiters:${slug}`,
        sourceJobId: j.id ?? "",
        url: publicUrl(j.ref, slug, j.id),
        title: j.name ?? "",
        company,
        location,
        workplaceType: loc.remote ? ("remote" as const) : null,
        postedAt: j.releasedDate ?? j.createdOn ?? null,
        description: null,
      };
    })
    .filter((s) => s.url !== "" && s.sourceJobId !== "");
}

export function smartRecruitersSource(config: SourceConfig): Source {
  const slug = String(config.params.companyToken ?? "");
  const company = String(config.params.company ?? slug);
  return {
    id: config.slug,
    async search(): Promise<JobSummary[]> {
      const all: JobSummary[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const raw = await fetchJson<SmartRecruitersResponse>(postingsUrl(slug, page * PAGE_SIZE));
        const parsed = parseSmartRecruiters(raw, slug, company);
        const pageLen = raw.content?.length ?? 0;
        all.push(...parsed);
        if (pageLen < PAGE_SIZE) break;
      }
      return all;
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
