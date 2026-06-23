import type {
  JobDetail,
  JobSummary,
  Source,
  SourceConfig,
  WorkplaceType,
} from "@homejobboard/shared";
import { fetchJson } from "./http.js";

// Recruitee — public per-tenant offers API (zero-auth). Endpoint + parsing ported
// from career-ops (MIT) `providers/recruitee.mjs`. Per-tenant subdomains are the
// variable part, so SSRF defence is a regex on the tenant slug before the host is
// built. The stored `url` is always the canonical on-domain
// `https://<slug>.recruitee.com/o/<offer-slug>` (safe even if a future liveness
// sweep fetches it); the tenant's branded careers domain — many tenants use one —
// is kept as the client-opened `applyUrl`. Offers carry the full description.

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

interface RecruiteeOffer {
  id?: number | string;
  slug?: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string | null;
  remote?: boolean | null;
  hybrid?: boolean | null;
  on_site?: boolean | null;
  careers_url?: string | null;
  careers_apply_url?: string | null;
  url?: string | null;
  employment_type_code?: string | null;
  published_at?: string | null;
  created_at?: string | null;
}
interface RecruiteeResponse {
  offers?: RecruiteeOffer[];
}

/** Any http(s) URL — for the client-opened applyUrl (not fetched server-side). */
function httpUrl(raw: string | null | undefined): string {
  if (typeof raw !== "string" || !raw) return "";
  try {
    const p = new URL(raw);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : "";
  } catch {
    return "";
  }
}

/** Recruitee timestamps are "YYYY-MM-DD HH:MM:SS UTC"; normalize to ISO. */
function toIso(raw: string | null | undefined): string | null {
  if (typeof raw !== "string" || !raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function workplace(j: RecruiteeOffer): WorkplaceType | null {
  if (j.remote) return "remote";
  if (j.hybrid) return "hybrid";
  if (j.on_site) return "onsite";
  return null;
}

/** Pure: map a Recruitee /api/offers/ response to normalized summaries. */
export function parseRecruitee(
  raw: RecruiteeResponse,
  slug: string,
  company: string,
): JobSummary[] {
  return (raw.offers ?? [])
    .map((j) => {
      const offerSlug = typeof j.slug === "string" ? j.slug : "";
      // Canonical on-domain URL (SSRF-safe by construction); fall back to a valid id.
      const url = offerSlug
        ? `https://${slug}.recruitee.com/o/${encodeURIComponent(offerSlug)}`
        : "";
      const assembled = [j.city, j.country, j.remote ? "Remote" : ""].filter(Boolean).join(", ");
      return {
        source: `recruitee:${slug}`,
        sourceJobId: String(j.id ?? offerSlug),
        url,
        applyUrl: httpUrl(j.careers_apply_url ?? j.careers_url) || null,
        title: j.title ?? "",
        company,
        location: j.location || assembled || null,
        workplaceType: workplace(j),
        postedAt: toIso(j.published_at ?? j.created_at),
        employmentType: j.employment_type_code ?? null,
        description: j.description ?? null,
      };
    })
    .filter((s) => s.url !== "" && s.sourceJobId !== "");
}

export function recruiteeSource(config: SourceConfig): Source {
  const slug = String(config.params.companyToken ?? "");
  const company = String(config.params.company ?? slug);
  return {
    id: config.slug,
    async search(): Promise<JobSummary[]> {
      if (!SLUG_RE.test(slug)) throw new Error(`recruitee: unsafe tenant slug "${slug}"`);
      const raw = await fetchJson<RecruiteeResponse>(`https://${slug}.recruitee.com/api/offers/`, {
        redirect: "error",
      });
      return parseRecruitee(raw, slug, company);
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
