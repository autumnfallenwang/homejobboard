import Link from "next/link";
import { getTracking, type TrackedJob } from "@/lib/api";
import { formatRelativeTime, statusMeta, urgencyMeta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Tracking() {
  let jobs: TrackedJob[] = [];
  try {
    jobs = await getTracking();
  } catch {
    return (
      <p className="rounded border border-primary/40 bg-primary/5 p-3 font-mono text-primary text-sm">
        Failed to load tracking (is the API running?).
      </p>
    );
  }

  const overdue = jobs.filter((j) => j.followUp?.overdue).length;

  return (
    <div>
      <header className="mb-4 border-border border-b pb-3">
        <h1 className="font-display text-2xl">Tracking</h1>
        <p className="mt-1 text-muted text-sm">
          Your engaged applications, overdue follow-ups first.
          {overdue > 0 && (
            <span className="ms-2 font-mono text-primary text-xs uppercase tracking-wider">
              {overdue} overdue
            </span>
          )}
        </p>
      </header>

      {jobs.length === 0 && (
        <p className="text-muted italic">
          No applications yet. Mark a job “Applied” from its detail page to start tracking it.
        </p>
      )}

      <div>
        {jobs.map((job) => {
          const st = statusMeta(job.status);
          const urg = job.followUp ? urgencyMeta(job.followUp.urgency) : null;
          const due = job.followUp?.nextFollowUpAt?.slice(0, 10);
          return (
            <article key={job.id} className="flex items-start gap-4 border-border border-b py-3.5">
              <div className="w-24 shrink-0 pt-0.5">
                <span className={`font-mono text-[11px] uppercase tracking-wider ${st.color}`}>
                  {st.label}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[17px] leading-snug">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="decoration-primary decoration-2 underline-offset-3 hover:underline"
                  >
                    {job.title}
                  </Link>
                </h3>
                <p className="mt-0.5 text-sm">
                  <span className="font-medium">{job.company}</span>
                  {job.appliedAt && (
                    <span className="text-muted">
                      {" · applied "}
                      {formatRelativeTime(job.appliedAt)}
                    </span>
                  )}
                  {job.followUpCount > 0 && (
                    <span className="text-muted"> · {job.followUpCount} follow-up(s)</span>
                  )}
                </p>
              </div>
              {urg && (
                <div className="hidden shrink-0 flex-col items-end gap-1 text-right sm:flex">
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${urg.color}`}
                  >
                    {urg.label}
                  </span>
                  {due && <span className="font-mono text-[11px] text-muted">next {due}</span>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
