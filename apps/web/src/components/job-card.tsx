import Link from "next/link";
import type { FeedJob } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { ScoreBadge } from "./score-badge";

/** One row in the feed: score, title→detail, company · location · age · source. */
export function JobCard({ job }: { job: FeedJob }) {
  return (
    <article className="flex items-start gap-4 border-border border-b py-4">
      <div className="w-10 shrink-0 pt-0.5 text-right">
        <ScoreBadge fitness={job.score?.fitness} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium leading-snug">
          <Link href={`/jobs/${job.id}`} className="hover:underline">
            {job.title}
          </Link>
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted text-sm">
          <span className="text-foreground/80">{job.company}</span>
          {job.location && <span>· {job.location}</span>}
          {job.postedAt && <span>· {formatRelativeTime(job.postedAt)}</span>}
          <span className="font-mono text-[11px] text-muted uppercase tracking-wide">
            · {job.source}
          </span>
          {job.status !== "new" && (
            <span className="rounded bg-border px-1.5 py-0.5 text-[10px] text-foreground/70 uppercase">
              {job.status}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
