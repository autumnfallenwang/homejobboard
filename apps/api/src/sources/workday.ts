import type { JobDetail, JobSummary, Source, SourceConfig } from "@homejobboard/shared";
import { fetchJson } from "./http.js";

// Workday — the public CXS jobs endpoint (POST, paginated). Endpoint + parsing
// ported from career-ops (MIT) `providers/workday.mjs`. A tenant is addressed by
// `<tenant>.<instance>.myworkdayjobs.com/<locale?>/<site>`; the CXS list lives at
// `…/wday/cxs/<tenant>/<site>/jobs`. Workday only exposes a relative "postedOn"
// label ("Posted Today", "Posted 5 Days Ago", "Posted 30+ Days Ago"); postedAt is
// derived from it against `now` and omitted for the unbounded "30+ Days Ago" form.

const PAGE_SIZE = 20;
const MAX_PAGES = 50; // safety cap — at most 1000 postings per site

export interface WorkdayConfig {
  tenant: string;
  instance: string;
  site: string;
}

interface WorkdayPosting {
  title?: string;
  externalPath?: string;
  locationsText?: string;
  postedOn?: string;
  bulletFields?: string[];
}
interface WorkdayResponse {
  total?: number;
  jobPostings?: WorkdayPosting[];
}

/**
 * Derive `{ tenant, instance, site }` from a `*.myworkdayjobs.com/<locale?>/<site>`
 * careers URL (e.g. `https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite`).
 * Returns null for non-Workday URLs. Exported so the settings add-board form can
 * resolve a pasted careers URL into stored params.
 */
export function detectWorkday(url: string): WorkdayConfig | null {
  const m = url.match(
    /^https:\/\/([\w-]+)\.(wd[\w-]*)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)/,
  );
  if (!m) return null;
  const [, tenant, instance, site] = m;
  if (!tenant || !instance || !site) return null;
  return { tenant, instance, site };
}

/** "Posted Today" → now, "Posted N Days Ago" → now − N days, "30+ Days Ago" → null. */
function parsePostedOn(label: string | undefined, now: Date): string | null {
  if (!label) return null;
  if (/posted\s+today/i.test(label)) return now.toISOString();
  if (/posted\s+yesterday/i.test(label)) return new Date(now.getTime() - 86_400_000).toISOString();
  const m = label.match(/posted\s+(\d+)(\+?)\s*day/i);
  if (!m || m[2] === "+") return null; // "30+ Days Ago" — unbounded, no usable date
  return new Date(now.getTime() - Number(m[1]) * 86_400_000).toISOString();
}

/** Pure: map a Workday CXS jobs response to normalized summaries. */
export function parseWorkday(
  raw: WorkdayResponse,
  cfg: WorkdayConfig,
  company: string,
  now: Date,
): JobSummary[] {
  const origin = `https://${cfg.tenant}.${cfg.instance}.myworkdayjobs.com`;
  const jobBase = `${origin}/${cfg.site}`; // externalPath is relative to the site, not host root
  const out: JobSummary[] = [];
  for (const j of raw.jobPostings ?? []) {
    if (!j.externalPath) continue;
    out.push({
      source: `workday:${cfg.tenant}`,
      sourceJobId: j.externalPath,
      url: jobBase + j.externalPath,
      title: j.title ?? "",
      company,
      location: j.locationsText || null,
      workplaceType: /remote/i.test(j.locationsText ?? "") ? "remote" : null,
      postedAt: parsePostedOn(j.postedOn, now),
      description: null,
    });
  }
  return out;
}

export function workdaySource(config: SourceConfig): Source {
  const cfg = resolveConfig(config);
  const company = String(config.params.company ?? cfg.tenant);
  const api = `https://${cfg.tenant}.${cfg.instance}.myworkdayjobs.com/wday/cxs/${cfg.tenant}/${cfg.site}/jobs`;
  return {
    id: config.slug,
    async search(): Promise<JobSummary[]> {
      const all: WorkdayPosting[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const raw = await fetchJson<WorkdayResponse>(api, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            limit: PAGE_SIZE,
            offset: page * PAGE_SIZE,
            searchText: "",
            appliedFacets: {},
          }),
        });
        const postings = raw.jobPostings ?? [];
        all.push(...postings);
        if (postings.length < PAGE_SIZE) break;
      }
      return parseWorkday({ jobPostings: all }, cfg, company, new Date());
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}

/** Resolve stored params (explicit tenant/instance/site, or a careersUrl to parse). */
function resolveConfig(config: SourceConfig): WorkdayConfig {
  const p = config.params;
  if (p.tenant && p.instance && p.site) {
    return { tenant: String(p.tenant), instance: String(p.instance), site: String(p.site) };
  }
  const detected = typeof p.careersUrl === "string" ? detectWorkday(p.careersUrl) : null;
  if (!detected) {
    throw new Error(`workday: cannot resolve tenant/instance/site for "${config.slug}"`);
  }
  return detected;
}
