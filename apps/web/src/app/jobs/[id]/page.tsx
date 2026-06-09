import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionBar } from "@/components/action-bar";
import { ScoreBadge } from "@/components/score-badge";
import { type FeedJob, getJob } from "@/lib/api";
import { formatRelativeTime, plainText } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let job: FeedJob;
  try {
    job = await getJob(id);
  } catch {
    notFound();
  }

  const meta = [
    job.location,
    job.workplaceType,
    job.employmentType,
    job.seniority,
    job.postedAt ? formatRelativeTime(job.postedAt) : null,
  ].filter(Boolean);

  return (
    <article className="space-y-5">
      <Link href="/" className="text-muted text-sm hover:text-foreground">
        ← Back to feed
      </Link>

      <header className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-semibold text-2xl leading-tight">{job.title}</h1>
          <div className="text-right">
            <ScoreBadge fitness={job.score?.fitness} />
            <div className="text-muted text-xs">fitness</div>
          </div>
        </div>
        <p className="text-foreground/80">{job.company}</p>
        <p className="text-muted text-sm">{meta.join(" · ")}</p>
        {(job.salaryMin || job.salaryMax) && (
          <p className="text-sm">
            💰 {job.salaryMin ?? "?"}–{job.salaryMax ?? "?"}
          </p>
        )}
      </header>

      <ActionBar jobId={job.id} applyUrl={job.applyUrl ?? job.url} initialStatus={job.status} />

      {job.score?.reasons && job.score.reasons.length > 0 && (
        <section className="rounded border border-border bg-card p-3">
          <h2 className="mb-1 font-medium text-sm">Why this score</h2>
          <ul className="list-disc space-y-0.5 pl-5 text-muted text-sm">
            {job.score.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-1 font-medium text-sm">Description</h2>
        <div className="whitespace-pre-wrap text-foreground/90 text-sm leading-relaxed">
          {plainText(job.description) || "No description."}
        </div>
      </section>
    </article>
  );
}
