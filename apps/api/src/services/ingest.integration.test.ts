import type { JobSummary, Source } from "@homejobboard/shared";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { listJobs } from "../db/queries.js";
import * as schema from "../db/schema.js";
import { jobs, sources } from "../db/schema.js";
import { runPoll } from "./ingest.js";

const url = process.env.DATABASE_URL;
const client = postgres(url ?? "postgresql://invalid");
const db = drizzle(client, { schema, casing: "snake_case" });

// In-memory fake adapter — no network. Returns a fixed set of summaries.
function fakeSource(id: string, summaries: JobSummary[]): Source {
  return {
    id,
    async search() {
      return summaries;
    },
    async fetchDetail(s) {
      return { description: s.description ?? null };
    },
  };
}

const summary = (over: Partial<JobSummary>): JobSummary => ({
  source: "fake",
  sourceJobId: "1",
  url: "https://example.com/1",
  title: "Engineer",
  company: "Acme",
  ...over,
});

describe.skipIf(!url)("runPoll integration (live DB)", () => {
  beforeEach(async () => {
    await db.delete(jobs);
    await db.delete(sources);
  });

  afterAll(async () => {
    await db.delete(jobs);
    await db.delete(sources);
    await client.end();
  });

  it("ingests new jobs and is idempotent on re-poll", async () => {
    const entries = [
      {
        slug: "fake-a",
        source: fakeSource("fake-a", [
          summary({ source: "fake-a", sourceJobId: "a1", title: "Backend Engineer" }),
          summary({ source: "fake-a", sourceJobId: "a2", title: "Frontend Engineer" }),
        ]),
      },
    ];

    const first = await runPoll(db, { entries });
    expect(first.inserted).toBe(2);

    const second = await runPoll(db, { entries });
    expect(second.inserted).toBe(0); // unique(source, sourceJobId) → no dups

    const rows = await listJobs(db, {});
    expect(rows).toHaveLength(2);
  });

  it("marks a cross-source duplicate and excludes it from the default listing", async () => {
    // Same company+title+location under two different sources → one duplicate.
    const shared = { title: "Staff Engineer", company: "Acme", location: "Remote" };
    const entries = [
      {
        slug: "fake-a",
        source: fakeSource("fake-a", [
          summary({ source: "fake-a", sourceJobId: "x", url: "https://a/x", ...shared }),
        ]),
      },
      {
        slug: "fake-b",
        source: fakeSource("fake-b", [
          summary({ source: "fake-b", sourceJobId: "y", url: "https://b/y", ...shared }),
        ]),
      },
    ];

    const res = await runPoll(db, { entries });
    expect(res.inserted).toBe(2);
    expect(res.duplicates).toBe(1);

    const visible = await listJobs(db, {});
    expect(visible).toHaveLength(1); // duplicate hidden by default

    const all = await listJobs(db, { includeDuplicates: true });
    expect(all).toHaveLength(2);
  });
});
