import Link from "next/link";
import type { FeedJob } from "@/lib/api";
import { formatRelativeTime, formatSalary, recommendation } from "@/lib/format";
import { ScoreBadge } from "./score-badge";

/** One ruled feed row: score meter | serif title + company line | data chips. */
export function JobCard({ job, index = 0 }: { job: FeedJob; index?: number }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const topReason = job.score?.verdict?.rationale ?? job.score?.reasons?.[0];
  const rec = job.score?.verdict ? recommendation(job.score.verdict.recommendation) : null;

  return (
    <article
      className="rise group flex items-start gap-4 border-border border-b py-3.5"
      style={{ "--i": Math.min(index, 16) } as React.CSSProperties}
    >
      <div className="flex w-12 shrink-0 flex-col items-end pt-1 text-right">
        <ScoreBadge fitness={job.score?.fitness} />
        {rec && (
          <span
            className={`mt-1 rounded border px-1 font-mono text-[9px] uppercase tracking-wider ${rec.color}`}
          >
            {rec.label}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[17px] leading-snug">
          <Link
            href={`/jobs/${job.id}`}
            className="decoration-primary decoration-2 underline-offset-3 group-hover:underline"
          >
            {job.title}
          </Link>
        </h3>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium">{job.company}</span>
          {job.location && <span className="text-muted">· {job.location}</span>}
          {job.workplaceType && (
            <span className="text-muted uppercase tracking-wide text-[11px] font-mono">
              {job.workplaceType}
            </span>
          )}
        </div>
        {topReason && (
          <p className="mt-1 line-clamp-1 text-[13px] text-muted italic">{topReason}</p>
        )}
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-1 pt-1 text-right sm:flex">
        {salary && <span className="font-mono text-[13px] tabular-nums">{salary}</span>}
        <span className="font-mono text-[11px] text-muted">
          {job.postedAt ? formatRelativeTime(job.postedAt) : "undated"}
        </span>
        <span className="font-mono text-[10px] text-muted/80 uppercase tracking-widest">
          {job.source}
          {job.status !== "new" && <span className="ms-1 text-primary">· {job.status}</span>}
        </span>
      </div>
    </article>
  );
}
