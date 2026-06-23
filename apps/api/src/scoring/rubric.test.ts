import { describe, expect, it } from "vitest";
import type { JobRow } from "../db/queries.js";
import { buildFitnessPrompt, parseFitnessVerdict } from "./rubric.js";

const VERDICT = {
  recommendation: "apply",
  subScores: { skills: 5, seniority: 4, domain: 4, compensation: 3, logistics: 5 },
  topStrengths: ["TS/Node match"],
  hardStops: [],
  softGaps: ["No Python"],
  rationale: "Strong fit.",
  confidence: "high",
};
const sample = (over: Record<string, unknown> = {}): string =>
  JSON.stringify({ fitness: 87, verdict: VERDICT, ...over });

const job = (over: Partial<JobRow> = {}): JobRow =>
  ({
    id: "j1",
    title: "Staff Engineer",
    company: "Acme",
    location: "Remote",
    description: "x".repeat(5000),
    workplaceType: "remote",
    employmentType: "Full-time",
    ...over,
  }) as JobRow;

describe("parseFitnessVerdict", () => {
  it("parses a markdown-fenced fitness + verdict", () => {
    const r = parseFitnessVerdict(["```json", sample(), "```"].join("\n"));
    expect(r.fitness).toBe(87);
    expect(r.verdict).toMatchObject({ recommendation: "apply", confidence: "high" });
    expect(r.verdict.subScores.skills).toBe(5);
  });

  it("throws when the verdict is missing", () => {
    expect(() => parseFitnessVerdict('{"fitness": 80}')).toThrow();
  });

  it("throws on out-of-range fitness", () => {
    expect(() => parseFitnessVerdict(sample({ fitness: 150 }))).toThrow();
  });

  it("throws on an invalid recommendation enum", () => {
    expect(() =>
      parseFitnessVerdict(
        JSON.stringify({ fitness: 50, verdict: { ...VERDICT, recommendation: "maybe" } }),
      ),
    ).toThrow();
  });
});

describe("buildFitnessPrompt", () => {
  it("includes the profile, title/company, and caps the description", () => {
    const p = buildFitnessPrompt(job(), "Senior TS engineer, remote.");
    expect(p).toContain("Senior TS engineer");
    expect(p).toContain("Staff Engineer");
    expect(p).toContain("Acme");
    // description sliced to 2500 chars (+ the "Description: " label)
    expect(p.length).toBeLessThan(2700);
  });
});
