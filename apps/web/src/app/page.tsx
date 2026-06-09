import Link from "next/link";
import { JobCard } from "@/components/job-card";
import { RefreshButton } from "@/components/refresh-button";
import { type FeedJob, type FeedQuery, listFeed } from "@/lib/api";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ sort?: string; status?: string }>;

const STATUSES = ["new", "applied", "dismissed"] as const;

export default async function Feed({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const sort: FeedQuery["sort"] = sp.sort === "rank" ? "rank" : "recent";
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "")
    ? (sp.status as FeedQuery["status"])
    : "new";

  let jobs: FeedJob[] = [];
  let error: string | null = null;
  try {
    jobs = await listFeed({ sort, status, limit: 100 });
  } catch (e) {
    error = e instanceof Error ? e.message : "failed to load";
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 text-sm">
          <Tab href={`/?sort=recent&status=${status}`} active={sort === "recent"}>
            Newest
          </Tab>
          <Tab href={`/?sort=rank&status=${status}`} active={sort === "rank"}>
            Best fit
          </Tab>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 text-sm">
            {STATUSES.map((s) => (
              <Tab key={s} href={`/?sort=${sort}&status=${s}`} active={status === s}>
                {s}
              </Tab>
            ))}
          </div>
          <RefreshButton />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">Error: {error}</p>}
      {!error && jobs.length === 0 && (
        <p className="py-12 text-center text-muted text-sm">
          No {status} jobs{sort === "rank" ? " scored yet" : ""}. Try Refresh.
        </p>
      )}
      <div>
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
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
      className={
        active
          ? "rounded bg-foreground px-2.5 py-1 text-background"
          : "rounded px-2.5 py-1 text-muted hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}
