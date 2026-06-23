import { describe, expect, it } from "vitest";
import { composite, fitnessVerdictSchema, freshness, jobScoreSchema } from "./score.js";

const now = new Date("2026-06-08T00:00:00.000Z");

describe("freshness", () => {
  it("is ~1 at age 0 and decays monotonically", () => {
    expect(freshness(now.toISOString(), now)).toBeCloseTo(1, 5);
    const day3 = freshness(new Date("2026-06-05T00:00:00Z").toISOString(), now);
    const day7 = freshness(new Date("2026-06-01T00:00:00Z").toISOString(), now);
    expect(day3).toBeGreaterThan(day7);
    expect(day7).toBeCloseTo(0.5, 1); // ~7-day half-life
  });

  it("stays within (0, 1] and treats null as neutral 0.5", () => {
    const f = freshness(new Date("2025-01-01T00:00:00Z").toISOString(), now);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThanOrEqual(1);
    expect(freshness(null, now)).toBe(0.5);
  });
});

describe("composite", () => {
  it("is fitness × freshness", () => {
    expect(composite(80, 0.5)).toBe(40);
    expect(composite(100, 1)).toBe(100);
  });
});

const validVerdict = {
  recommendation: "apply",
  subScores: { skills: 5, seniority: 4, domain: 4, compensation: 3, logistics: 5 },
  topStrengths: ["Strong TS/Node match"],
  hardStops: [],
  softGaps: ["No mention of Python"],
  rationale: "Strong stack and seniority fit, remote-friendly.",
  confidence: "high",
};

describe("fitnessVerdictSchema", () => {
  it("accepts a well-formed verdict", () => {
    expect(fitnessVerdictSchema.parse(validVerdict).recommendation).toBe("apply");
  });

  it("rejects an unknown recommendation enum", () => {
    expect(() =>
      fitnessVerdictSchema.parse({ ...validVerdict, recommendation: "maybe" }),
    ).toThrow();
  });

  it("rejects an out-of-range sub-score", () => {
    expect(() =>
      fitnessVerdictSchema.parse({
        ...validVerdict,
        subScores: { ...validVerdict.subScores, skills: 6 },
      }),
    ).toThrow();
  });
});

describe("jobScoreSchema", () => {
  const base = {
    id: "11111111-1111-1111-1111-111111111111",
    jobId: "22222222-2222-2222-2222-222222222222",
    fitness: 80,
    reasons: ["stack match"],
    model: "claude-haiku-4-5",
    composite: 56,
    scoredAt: "2026-06-22T00:00:00.000Z",
  };

  it("accepts a null verdict (pre-M08 row)", () => {
    expect(jobScoreSchema.parse({ ...base, verdict: null }).verdict).toBeNull();
  });

  it("accepts a populated verdict", () => {
    expect(jobScoreSchema.parse({ ...base, verdict: validVerdict }).verdict?.confidence).toBe(
      "high",
    );
  });
});
