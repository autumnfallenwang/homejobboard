import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { JobCard } from "@/components/job-card";
import { RefreshButton } from "@/components/refresh-button";
import {
  type FeedJob,
  type FeedQuery,
  type FeedStats,
  getStats,
  listFeed,
  listSources,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  sort?: string;
  status?: string;
  q?: string;
  source?: string;
  minScore?: string;
}>;

const STATUSES = [
  { key: "new", label: "Inbox" },
  { key: "applied", label: "Applied" },
  { key: "discarded", label: "Discarded" },
] as const;

export default async function Feed({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const sort: FeedQuery["sort"] = sp.sort === "rank" ? "rank" : "recent";
  const status = (["new", "applied", "discarded"] as const).find((s) => s === sp.status) ?? "new";
  const q = sp.q?.trim() || undefined;
  const source = sp.source?.trim() || undefined;
  const minScore = Number(sp.minScore) > 0 ? Number(sp.minScore) : undefined;

  let jobs: FeedJob[] = [];
  let stats: FeedStats | null = null;
  let families: string[] = [];
  let error: string | null = null;
  try {
    const [feed, sources, s] = await Promise.all([
      listFeed({ sort, status, q, source, minScore, limit: 100 }),
      listSources().catch(() => []),
      getStats().catch(() => null),
    ]);
    jobs = feed;
    stats = s;
    families = [...new Set(sources.map((src) => src.slug.split(":")[0] ?? src.slug))].sort();
  } catch (e) {
    error = e instanceof Error ? e.message : "failed to load";
  }

  // Preserve the rest of the query when switching one dimension.
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { sort, status, q, source, minScore: minScore?.toString(), ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "sort" && v === "recent") && !(k === "status" && v === "new")) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };

  const counts: Record<string, number | undefined> = {
    new: stats?.new,
    applied: stats?.applied,
    discarded: stats?.discarded,
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        {/* Sort: editorial underline tabs */}
        <div className="flex gap-5 font-mono text-xs uppercase tracking-widest">
          <Tab href={href({ sort: "recent" })} active={sort === "recent"}>
            Newest
          </Tab>
          <Tab href={href({ sort: "rank" })} active={sort === "rank"}>
            Best fit
          </Tab>
        </div>
        <div className="flex items-center gap-3">
          {/* Status: segmented triage */}
          <div className="flex overflow-hidden rounded border border-border font-mono text-xs">
            {STATUSES.map((s) => (
              <Link
                key={s.key}
                href={href({ status: s.key })}
                className={cn(
                  "px-2.5 py-1 transition-colors",
                  status === s.key
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground",
                )}
              >
                {s.label}
                {counts[s.key] != null && (
                  <span className={cn("ms-1", status === s.key ? "opacity-70" : "opacity-60")}>
                    {counts[s.key]}
                  </span>
                )}
              </Link>
            ))}
          </div>
          <RefreshButton />
        </div>
      </div>

      {/* Narrowing: search + source family + score floor (plain GET form) */}
      <form
        method="GET"
        className="mb-4 flex flex-wrap items-center gap-2 border-border border-b pb-3"
      >
        {sort === "rank" && <input type="hidden" name="sort" value="rank" />}
        {status !== "new" && <input type="hidden" name="status" value={status} />}
        <div className="relative">
          <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-2 h-3.5 w-3.5 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="title or company…"
            className="w-48 rounded border border-border bg-card py-1 ps-7 pe-2 text-sm placeholder:text-muted/70 focus:border-primary focus:outline-none"
          />
        </div>
        <select
          name="source"
          defaultValue={source ?? ""}
          className="rounded border border-border bg-card px-2 py-1 font-mono text-xs"
        >
          <option value="">all sources</option>
          {families.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <select
          name="minScore"
          defaultValue={minScore?.toString() ?? ""}
          className="rounded border border-border bg-card px-2 py-1 font-mono text-xs"
        >
          <option value="">any score</option>
          <option value="80">80+</option>
          <option value="60">60+</option>
          <option value="40">40+</option>
        </select>
        <button
          type="submit"
          className="rounded border border-border px-2.5 py-1 font-mono text-muted text-xs uppercase tracking-wider transition-colors hover:border-primary hover:text-primary"
        >
          Filter
        </button>
        {(q || source || minScore) && (
          <Link
            href={href({ q: undefined, source: undefined, minScore: undefined })}
            className="font-mono text-muted text-xs hover:text-primary"
          >
            clear
          </Link>
        )}
        <span className="ms-auto font-mono text-[11px] text-muted tabular-nums">
          {jobs.length} listing{jobs.length === 1 ? "" : "s"}
        </span>
      </form>

      {error && (
        <p className="rounded border border-primary/40 bg-primary/5 p-3 font-mono text-primary text-sm">
          API unreachable: {error}
        </p>
      )}
      {!error && jobs.length === 0 && (
        <div className="py-16 text-center">
          <p className="font-display text-lg text-muted italic">Nothing here.</p>
          <p className="mt-1 font-mono text-muted text-xs">
            {status === "new"
              ? "Hit Refresh to poll the boards, or loosen the filters."
              : `No ${status} jobs yet.`}
          </p>
        </div>
      )}
      <div className="border-border border-t">
        {jobs.map((job, i) => (
          <JobCard key={job.id} job={job} index={i} />
        ))}
      </div>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "border-b-2 pb-1 transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
