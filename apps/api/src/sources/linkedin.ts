import {
  type JobDetail,
  type JobSummary,
  parsePostedSince,
  type Source,
  type SourceConfig,
} from "@homejobboard/shared";
import { cleanText } from "./html.js";
import { fetchText } from "./http.js";

// Unauthenticated LinkedIn guest endpoints (list HTML + detail HTML). The only
// two-stage adapter: `search` returns cards without a description; `fetchDetail`
// fetches the per-job page for the full posting. Ported from poc/linkedin_url_fetch.py.
// Undocumented + ToS-gray: keep volume polite (the pipeline throttles detail fetches).

const LIST_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const DETAIL_URL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting";

function grab(block: string, pattern: RegExp): string | null {
  const m = block.match(pattern);
  return m?.[1] ? cleanText(m[1]) : null;
}

/** Pure: parse the guest job-search list HTML into stage-1 summaries (no description). */
export function parseLinkedInList(html: string): JobSummary[] {
  const cards = html.split(/<li>\s*<div class="base-card/).slice(1);
  const out: JobSummary[] = [];
  for (const card of cards) {
    const urn = card.match(/urn:li:jobPosting:(\d+)/);
    const link = card.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/);
    const jobId = urn?.[1] ?? link?.[1]?.match(/-(\d+)$/)?.[1] ?? null;
    if (!jobId) continue;
    const datetime = card.match(/datetime="([^"]+)"/);
    out.push({
      source: "linkedin",
      sourceJobId: jobId,
      url: link?.[1] ?? `https://www.linkedin.com/jobs/view/${jobId}`,
      title: grab(card, /base-search-card__title">(.*?)<\/h3>/s) ?? "",
      company: grab(card, /base-search-card__subtitle">(.*?)<\/h4>/s) ?? "",
      location: grab(card, /job-search-card__location">(.*?)<\/span>/s),
      postedAt: datetime?.[1] ?? null,
      description: null,
    });
  }
  return out;
}

/** Pure: parse a guest job-detail page into the full posting (description + criteria). */
export function parseLinkedInDetail(html: string): JobDetail {
  const crit = new Map<string, string>();
  const re =
    /description__job-criteria-subheader">(.*?)<\/h3>.*?description__job-criteria-text[^>]*>(.*?)<\/span>/gs;
  for (const m of html.matchAll(re)) {
    if (m[1] && m[2]) crit.set(cleanText(m[1]), cleanText(m[2]));
  }
  const desc = html.match(/show-more-less-html__markup[^>]*>(.*?)<\/div>/s);
  const jobFunction = crit.get("Job function");
  const industries = crit.get("Industries");
  const tags = [jobFunction, industries].filter((t): t is string => Boolean(t));
  return {
    description: desc?.[1] ? cleanText(desc[1]) : null,
    seniority: crit.get("Seniority level") ?? null,
    employmentType: crit.get("Employment type") ?? null,
    tags: tags.length ? tags : null,
  };
}

export function linkedinSource(config: SourceConfig): Source {
  const p = config.params;
  return {
    id: config.slug,
    // Source params win; the cross-source JobFilters fill any gaps (LinkedIn is one
    // of the few boards with true server-side keyword/location/window filtering).
    async search(filters): Promise<JobSummary[]> {
      const windowMs = parsePostedSince(filters.postedSince);
      const params = new URLSearchParams({
        keywords: String(p.keywords ?? filters.keywords.join(" ")),
        location: String(p.location ?? filters.location ?? ""),
        f_TPR: String(p.tpr ?? (windowMs ? `r${Math.floor(windowMs / 1000)}` : "r86400")),
        sortBy: "DD",
        start: "0",
      });
      return parseLinkedInList(await fetchText(`${LIST_URL}?${params.toString()}`));
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return parseLinkedInDetail(await fetchText(`${DETAIL_URL}/${summary.sourceJobId}`));
    },
  };
}
