import type { JobDetail, JobSummary, Source, SourceConfig } from "@homejobboard/shared";
import { XMLParser } from "fast-xml-parser";
import { decodeEntities } from "./html.js";
import { fetchText } from "./http.js";

// processEntities:false avoids fast-xml-parser's entity-expansion limit (the full
// WWR feed's escaped HTML descriptions exceed it). We decode entities ourselves on
// the fields we use, which also un-escapes the description into real HTML.
const parser = new XMLParser({ ignoreAttributes: true, trimValues: true, processEntities: false });

interface WwrItem {
  title?: string;
  category?: string;
  type?: string;
  region?: string;
  description?: string;
  pubDate?: string;
  link?: string;
  guid?: string;
}

/** Pure: parse a We Work Remotely RSS feed into normalized summaries. */
export function parseWwr(xml: string): JobSummary[] {
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: WwrItem | WwrItem[] } } };
  const raw = doc.rss?.channel?.item;
  const items: WwrItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return items.map((it) => {
    const link = it.link ?? it.guid ?? "";
    const { company, title } = splitTitle(decodeEntities(it.title ?? ""));
    return {
      source: "wwr",
      sourceJobId: lastPathSegment(link) || link,
      url: link,
      title,
      company,
      location: it.region || null,
      workplaceType: "remote" as const,
      postedAt: it.pubDate ? new Date(it.pubDate).toISOString() : null,
      employmentType: it.type ?? null,
      tags: it.category ? [it.category] : null,
      description: it.description ? decodeEntities(it.description) : null,
    };
  });
}

/** WWR titles are "Company: Role". Split on the first ": "; fall back to the whole string. */
function splitTitle(raw: string): { company: string; title: string } {
  const idx = raw.indexOf(": ");
  if (idx === -1) return { company: "", title: raw };
  return { company: raw.slice(0, idx).trim(), title: raw.slice(idx + 2).trim() };
}

function lastPathSegment(url: string): string {
  return url.split("?")[0]?.replace(/\/$/, "").split("/").pop() ?? "";
}

export function wwrSource(config: SourceConfig): Source {
  const feedUrl = String(config.params.feedUrl ?? "https://weworkremotely.com/remote-jobs.rss");
  return {
    id: config.slug,
    async search(): Promise<JobSummary[]> {
      return parseWwr(await fetchText(feedUrl));
    },
    async fetchDetail(summary: JobSummary): Promise<JobDetail> {
      return { description: summary.description ?? null };
    },
  };
}
