import type { JobDetail, JobSummary, Source, SourceConfig } from "@homejobboard/shared";
import { cleanText } from "./html.js";
import { fetchJson } from "./http.js";

// HN "Ask HN: Who is hiring?" via the Algolia HN API (zero-auth, documented).
// One monthly story; each TOP-LEVEL comment is a job post, by convention headed
// "Company | Role | Location | …" free text. Algolia returns full comment_text in
// the list call, so stage 2 is a no-op. Newest-first via search_by_date.

const ALGOLIA = "https://hn.algolia.com/api/v1";

interface HnHit {
  objectID: string;
  author?: string;
  title?: string;
  comment_text?: string | null;
  created_at?: string;
  parent_id?: number;
  story_id?: number;
}
interface HnSearch {
  hits: HnHit[];
}

/**
 * Pure: map a thread's comment hits to summaries. Keeps only top-level comments
 * whose first line follows the "Company | Role | …" convention — replies and
 * off-format chatter are dropped (the convention holds for real postings).
 */
export function parseHnComments(hits: HnHit[], storyId: number): JobSummary[] {
  const out: JobSummary[] = [];
  for (const hit of hits) {
    if (hit.parent_id !== storyId || !hit.comment_text) continue;
    const headline = cleanText(hit.comment_text.split(/<p>/i)[0] ?? "");
    const segments = headline.split("|").map((s) => s.trim());
    if (segments.length < 2 || !segments[0]) continue;
    out.push({
      source: "hn",
      sourceJobId: hit.objectID,
      url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      title: segments[1] || headline.slice(0, 120),
      company: segments[0].slice(0, 80),
      location: segments[2] || null,
      workplaceType: /remote/i.test(headline) ? "remote" : null,
      postedAt: hit.created_at ?? null,
      description: hit.comment_text,
    });
  }
  return out;
}

/** Pure: pick the latest "Who is hiring?" story id from a story search. */
export function pickHiringStory(hits: HnHit[]): number | null {
  const hit = hits.find((h) => /who is hiring/i.test(h.title ?? ""));
  return hit ? Number(hit.objectID) : null;
}

export function hnSource(config: SourceConfig): Source {
  const hitsPerPage = Number(config.params.hitsPerPage ?? 250);
  return {
    id: config.slug,
    async search(): Promise<JobSummary[]> {
      const stories = await fetchJson<HnSearch>(
        `${ALGOLIA}/search_by_date?tags=story,author_whoishiring&query=${encodeURIComponent('"who is hiring"')}&hitsPerPage=10`,
      );
      const storyId = pickHiringStory(stories.hits);
      if (!storyId) throw new Error("no current 'Who is hiring?' thread found");
      const comments = await fetchJson<HnSearch>(
        `${ALGOLIA}/search_by_date?tags=comment,story_${storyId}&hitsPerPage=${hitsPerPage}`,
      );
      return parseHnComments(comments.hits, storyId);
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
