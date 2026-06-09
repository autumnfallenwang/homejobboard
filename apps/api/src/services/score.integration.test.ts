import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { listRankedJobs, type NewJob } from "../db/queries.js";
import * as schema from "../db/schema.js";
import { jobs, settings } from "../db/schema.js";

// Mock the gateway client; return fitness in call order (jobs are scored by fetchedAt asc).
const mockChat = vi.fn();
vi.mock("./llm-client.js", () => ({ chatCompletion: (...a: unknown[]) => mockChat(...a) }));

const { scoreUnscoredJobs } = await import("./score.js");
const { seedDefaultSettings } = await import("./settings.js");

const url = process.env.DATABASE_URL;
const client = postgres(url ?? "postgresql://invalid");
const db = drizzle(client, { schema, casing: "snake_case" });

const baseJob = (over: Partial<NewJob>): NewJob => ({
  source: "remoteok",
  sourceJobId: "x",
  url: "https://x",
  title: "Engineer",
  company: "Acme",
  dedupKey: "acme|engineer|",
  postedAt: new Date("2026-06-08T00:00:00Z"),
  ...over,
});

describe.skipIf(!url)("scoreUnscoredJobs integration (live DB, mocked LLM)", () => {
  beforeEach(async () => {
    await db.delete(jobs);
    await db.delete(settings);
    await seedDefaultSettings(db);
    mockChat.mockReset();
  });

  afterAll(async () => {
    await db.delete(jobs);
    await db.delete(settings);
    await client.end();
  });

  it("scores unscored non-duplicate jobs, ranks them, and is idempotent", async () => {
    await db.insert(jobs).values([
      baseJob({
        sourceJobId: "low",
        title: "Low Fit",
        fetchedAt: new Date("2026-06-08T01:00:00Z"),
      }),
      baseJob({
        sourceJobId: "high",
        title: "High Fit",
        fetchedAt: new Date("2026-06-08T02:00:00Z"),
      }),
    ]);
    // A duplicate must NOT be scored.
    const [canonical] = await db.select().from(jobs).limit(1);
    await db.insert(jobs).values(
      baseJob({
        sourceJobId: "dup",
        title: "Dup",
        duplicateOfId: canonical!.id,
        fetchedAt: new Date("2026-06-08T03:00:00Z"),
      }),
    );

    mockChat
      .mockResolvedValueOnce('{"fitness": 30, "reasons": ["meh"]}') // "low" (older fetchedAt)
      .mockResolvedValueOnce('{"fitness": 90, "reasons": ["great"]}'); // "high"

    const res = await scoreUnscoredJobs(db, 50);
    expect(res).toEqual({ scored: 2, errors: 0 }); // duplicate skipped
    expect(mockChat).toHaveBeenCalledTimes(2);

    const ranked = await listRankedJobs(db, {});
    expect(ranked).toHaveLength(2);
    expect(ranked[0]?.title).toBe("High Fit"); // higher composite first
    expect(ranked[0]?.score.fitness).toBe(90);

    // Idempotent: nothing left unscored.
    const again = await scoreUnscoredJobs(db, 50);
    expect(again.scored).toBe(0);
  });
});
