import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { jobScores, jobs, sources } from "./schema.js";

// Cheap structural guard (no DB): the tables exist and expose the key columns the
// rest of the pipeline depends on. Full behaviour is in schema.integration.test.ts.
describe("db schema", () => {
  it("defines the three core tables with expected names", () => {
    expect(getTableConfig(sources).name).toBe("sources");
    expect(getTableConfig(jobs).name).toBe("jobs");
    expect(getTableConfig(jobScores).name).toBe("job_scores");
  });

  it("jobs exposes identity, freshness, and dedup columns", () => {
    // getTableConfig reports the JS-key column names; snake_case conversion happens
    // at the client level (casing option). Normalize so the guard is casing-agnostic.
    const norm = (s: string) => s.toLowerCase().replace(/_/g, "");
    const cols = getTableConfig(jobs).columns.map((c) => norm(c.name));
    for (const name of ["source", "sourceJobId", "url", "postedAt", "dedupKey"]) {
      expect(cols).toContain(norm(name));
    }
  });

  it("sources has a unique slug", () => {
    const cols = getTableConfig(sources).columns;
    const slug = cols.find((c) => c.name === "slug");
    expect(slug?.isUnique).toBe(true);
  });
});
