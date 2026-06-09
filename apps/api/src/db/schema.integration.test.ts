import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { jobScores, jobs, sources } from "./schema.js";

// Gated: needs a live Postgres with the schema migrated (DATABASE_URL set).
const url = process.env.DATABASE_URL;
const client = postgres(url ?? "postgresql://invalid");
const db = drizzle(client, { schema, casing: "snake_case" });

describe.skipIf(!url)("db schema integration (live DB)", () => {
  beforeEach(async () => {
    await db.delete(jobs); // cascade clears job_scores
    await db.delete(sources);
  });

  afterAll(async () => {
    await db.delete(jobs);
    await db.delete(sources);
    await client.end();
  });

  it("persists a source → job → score graph and reads it back", async () => {
    await db.insert(sources).values({ slug: "remoteok", kind: "remoteok", params: {} });

    const [job] = await db
      .insert(jobs)
      .values({
        source: "remoteok",
        sourceJobId: "abc123",
        url: "https://remoteok.com/remote-jobs/abc123",
        title: "Senior TypeScript Engineer",
        company: "Acme",
        dedupKey: "acme|senior typescript engineer|",
      })
      .returning();
    expect(job?.id).toBeDefined();

    await db.insert(jobScores).values({
      jobId: job!.id,
      fitness: 87,
      reasons: ["strong stack match"],
      model: "claude",
      composite: 0.7,
    });

    const rows = await db.select().from(jobScores).where(eq(jobScores.jobId, job!.id));
    expect(rows[0]?.fitness).toBe(87);
  });

  it("enforces unique(source, sourceJobId)", async () => {
    const row = {
      source: "remoteok",
      sourceJobId: "dup",
      url: "https://remoteok.com/remote-jobs/dup",
      title: "Dev",
      company: "Acme",
      dedupKey: "acme|dev|",
    };
    await db.insert(jobs).values(row);
    await expect(db.insert(jobs).values(row)).rejects.toThrow();
  });

  it("cascades score deletion when the job is deleted", async () => {
    const [job] = await db
      .insert(jobs)
      .values({
        source: "remoteok",
        sourceJobId: "casc",
        url: "https://remoteok.com/remote-jobs/casc",
        title: "Dev",
        company: "Acme",
        dedupKey: "acme|dev|",
      })
      .returning();
    await db
      .insert(jobScores)
      .values({ jobId: job!.id, fitness: 50, model: "claude", composite: 0.4 });

    await db.delete(jobs).where(eq(jobs.id, job!.id));

    const remaining = await db.select().from(jobScores).where(eq(jobScores.jobId, job!.id));
    expect(remaining).toHaveLength(0);
  });
});
