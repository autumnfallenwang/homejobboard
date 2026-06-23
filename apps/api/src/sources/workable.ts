import type { JobDetail, JobSummary, Source, SourceConfig } from "@homejobboard/shared";
import { fetchText } from "./http.js";

// Workable — public markdown feed at `apply.workable.com/<slug>/jobs.md` (the
// documented JSON API needs an auth token; the markdown feed is the only no-auth
// surface). Endpoint + parsing ported from career-ops (MIT) `providers/workable.mjs`.
// The feed is a table `| Title | Department | Location | Type | Salary | Posted | Details |`
// where Details is a `[View](https://apply.workable.com/<slug>/...md)` link; off-domain
// or non-HTTPS links are skipped. No description in the feed → fetchDetail is a no-op.

function parsePosted(posted: string): string | null {
  if (!posted) return null;
  const t = Date.parse(posted);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Last non-empty path segment of the view URL — Workable's stable per-posting token. */
function jobIdFromUrl(url: string): string {
  try {
    const segs = new URL(url).pathname.split("/").filter(Boolean);
    return segs[segs.length - 1] ?? "";
  } catch {
    return "";
  }
}

/** Pure: parse Workable's public markdown feed into normalized summaries. */
export function parseWorkableMarkdown(text: string, slug: string, company: string): JobSummary[] {
  if (typeof text !== "string") return [];
  const out: JobSummary[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("|") || !line.includes("[View]")) continue;
    const cols = line.split("|").map((c) => c.trim());
    // Cols: ['', title, dept, location, type, salary, posted, '[View](url.md)', '']
    if (cols.length < 8) continue;
    const title = cols[1];
    if (!title || title === "Title") continue;
    const location = cols[3] || "";

    const urlMatch = line.match(/\[View\]\(([^)]+)\)/);
    let url = urlMatch?.[1] ?? "";
    if (url.endsWith(".md")) url = url.slice(0, -3);
    if (!url) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.hostname !== "apply.workable.com") continue;
      url = parsed.href;
    } catch {
      continue;
    }

    out.push({
      source: `workable:${slug}`,
      sourceJobId: jobIdFromUrl(url),
      url,
      title,
      company,
      location: location || null,
      workplaceType: /remote/i.test(location) ? "remote" : null,
      postedAt: parsePosted(cols[6] ?? ""),
      description: null,
    });
  }
  return out;
}

export function workableSource(config: SourceConfig): Source {
  const slug = String(config.params.companyToken ?? "");
  const company = String(config.params.company ?? slug);
  return {
    id: config.slug,
    async search(): Promise<JobSummary[]> {
      // redirect:'error' keeps the final host pinned to apply.workable.com (SSRF guard).
      const text = await fetchText(`https://apply.workable.com/${slug}/jobs.md`, {
        redirect: "error",
      });
      return parseWorkableMarkdown(text, slug, company);
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
