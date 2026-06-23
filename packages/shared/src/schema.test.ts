import { describe, expect, it } from "vitest";
import { jobFiltersSchema } from "./filters.js";
import { dedupKey, jobSchema } from "./job.js";
import { jobScoreSchema } from "./score.js";
import { sourceConfigSchema, sourceKindSchema } from "./source.js";

const storedJob = {
  id: "11111111-1111-1111-1111-111111111111",
  source: "greenhouse:stripe",
  sourceJobId: "4425291706",
  url: "https://job-boards.greenhouse.io/stripe/jobs/4425291706",
  applyUrl: null,
  title: "Software Engineer",
  company: "Stripe",
  location: "San Francisco, CA",
  workplaceType: "onsite",
  postedAt: "2026-06-08T12:00:00.000Z",
  description: "Build payments infrastructure.",
  salaryMin: 180000,
  salaryMax: 240000,
  employmentType: "Full-time",
  seniority: "Mid-Senior level",
  tags: ["typescript", "payments"],
  fetchedAt: "2026-06-08T12:01:00.000Z",
  dedupKey: "stripe|software engineer|san francisco ca",
  duplicateOfId: null,
  status: "new",
};

describe("jobSchema", () => {
  it("parses a representative stored row", () => {
    expect(jobSchema.parse(storedJob)).toMatchObject({ source: "greenhouse:stripe" });
  });

  it("rejects an invalid url", () => {
    expect(jobSchema.safeParse({ ...storedJob, url: "not-a-url" }).success).toBe(false);
  });
});

describe("jobScoreSchema", () => {
  it("rejects fitness out of 0–100", () => {
    const base = {
      id: "22222222-2222-2222-2222-222222222222",
      jobId: storedJob.id,
      reasons: null,
      model: "claude",
      composite: 0.5,
      scoredAt: "2026-06-08T12:02:00.000Z",
    };
    expect(jobScoreSchema.safeParse({ ...base, fitness: 80 }).success).toBe(true);
    expect(jobScoreSchema.safeParse({ ...base, fitness: 150 }).success).toBe(false);
  });
});

describe("jobFiltersSchema", () => {
  it("defaults keywords and excludeKeywords to empty arrays", () => {
    expect(jobFiltersSchema.parse({})).toEqual({ keywords: [], excludeKeywords: [] });
  });
});

describe("source schemas", () => {
  it("accepts a greenhouse source config and rejects an unknown kind", () => {
    expect(
      sourceConfigSchema.safeParse({
        id: "33333333-3333-3333-3333-333333333333",
        slug: "greenhouse:stripe",
        kind: "greenhouse",
        enabled: true,
        params: { companyToken: "stripe" },
        lastPolledAt: null,
        createdAt: "2026-06-08T00:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(sourceKindSchema.safeParse("monster").success).toBe(false);
  });
});

describe("dedupKey", () => {
  it("normalizes case, punctuation, and whitespace", () => {
    expect(dedupKey("  Stripe, Inc. ", "Software   Engineer", "San Francisco")).toBe(
      dedupKey("stripe inc", "software engineer", "san francisco"),
    );
  });

  it("is stable across calls", () => {
    expect(dedupKey("Acme", "Dev", "NYC")).toBe(dedupKey("Acme", "Dev", "NYC"));
  });
});
