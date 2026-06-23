import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionBar } from "@/components/action-bar";
import { MaterialsPanel } from "@/components/materials-panel";
import { ScoreBadge } from "@/components/score-badge";
import { VerdictPanel } from "@/components/verdict-panel";
import { getJob, type JobDetailResponse } from "@/lib/api";
import { descriptionBlocks, formatRelativeTime, formatSalary } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let job: JobDetailResponse;
  try {
    job = await getJob(id);
  } catch {
    notFound();
  }

  const blocks = descriptionBlocks(job.description);
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const facts: Array<[string, string]> = [];
  if (job.location) facts.push(["location", job.location]);
  if (job.workplaceType) facts.push(["workplace", job.workplaceType]);
  if (job.employmentType) facts.push(["type", job.employmentType]);
  if (job.seniority) facts.push(["seniority", job.seniority]);
  if (salary) facts.push(["salary", salary]);
  if (job.postedAt) facts.push(["posted", formatRelativeTime(job.postedAt)]);
  facts.push(["source", job.source]);

  return (
    <article>
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 font-mono text-muted text-xs uppercase tracking-widest transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Feed
      </Link>

      <header className="mt-4 border-border border-b pb-5">
        <p className="font-mono text-muted text-sm">{job.company}</p>
        <h1 className="mt-1 max-w-3xl font-display text-3xl leading-tight sm:text-4xl">
          {job.title}
        </h1>
      </header>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_280px]">
        {/* Description */}
        <section className="min-w-0 text-[15px] leading-relaxed">
          {blocks.length === 0 && <p className="text-muted italic">No description captured.</p>}
          {blocks.map((b, i) =>
            b.type === "h" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: static render of parsed text
              <h2 key={i} className="mt-5 mb-1.5 font-display font-semibold text-base first:mt-0">
                {b.text}
              </h2>
            ) : b.type === "li" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: static render of parsed text
              <p key={i} className="my-1 ps-4 text-foreground/90">
                <span className="-ms-4 me-2 inline-block w-2 text-primary">›</span>
                {b.text}
              </p>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: static render of parsed text
              <p key={i} className="my-2.5 text-foreground/90">
                {b.text}
              </p>
            ),
          )}
        </section>

        {/* Sticky verdict panel */}
        <aside className="lg:order-last">
          <div className="space-y-5 lg:sticky lg:top-6">
            <div className="rounded border border-border bg-card p-4">
              <div className="flex items-end justify-between">
                <ScoreBadge fitness={job.score?.fitness} size="lg" />
                <span className="font-mono text-[10px] text-muted uppercase tracking-widest">
                  fitness
                  {job.score?.model && <span className="block text-end">{job.score.model}</span>}
                </span>
              </div>
              {job.score?.verdict ? (
                <VerdictPanel verdict={job.score.verdict} />
              ) : (
                job.score?.reasons &&
                job.score.reasons.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-border border-t pt-3 text-[13px] text-foreground/85 leading-snug">
                    {job.score.reasons.map((r) => (
                      <li key={r} className="flex gap-2">
                        <span className="text-primary">›</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                )
              )}
            </div>

            <ActionBar
              jobId={job.id}
              applyUrl={job.applyUrl ?? job.url}
              initialStatus={job.status}
            />

            <MaterialsPanel jobId={job.id} />

            <dl className="space-y-1.5 font-mono text-[13px]">
              {facts.map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-3 border-border/60 border-b pb-1.5"
                >
                  <dt className="text-muted text-xs uppercase tracking-wider">{k}</dt>
                  <dd className="text-end">{v}</dd>
                </div>
              ))}
            </dl>

            {job.alsoSeenOn.length > 0 && (
              <div className="font-mono text-[13px]">
                <p className="mb-1.5 text-muted text-xs uppercase tracking-wider">also seen on</p>
                <ul className="space-y-1">
                  {job.alsoSeenOn.map((d) => (
                    <li key={d.id}>
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-primary"
                      >
                        {d.source} <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <a
              href={job.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-muted text-xs hover:text-primary"
            >
              original posting <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </aside>
      </div>
    </article>
  );
}
