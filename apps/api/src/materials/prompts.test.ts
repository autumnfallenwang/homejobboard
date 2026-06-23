import { describe, expect, it } from "vitest";
import type { JobRow } from "../db/queries.js";
import { buildCoverPrompt, buildCvPrompt, parseMaterial } from "./prompts.js";

const job = (over: Partial<JobRow> = {}): JobRow =>
  ({
    id: "j1",
    title: "Staff Platform Engineer",
    company: "Acme",
    location: "Remote",
    description: "Build platform.",
    ...over,
  }) as JobRow;

describe("buildCvPrompt", () => {
  it("includes the CV and the job title", () => {
    const p = buildCvPrompt(job(), "# Jane Doe\nStaff engineer, 8y TS.", "remote only");
    expect(p).toContain("Jane Doe");
    expect(p).toContain("Staff Platform Engineer");
  });
});

describe("buildCoverPrompt", () => {
  it("includes the company and role", () => {
    const p = buildCoverPrompt(job(), "# Jane Doe", "remote only");
    expect(p).toContain("Acme");
    expect(p).toContain("Staff Platform Engineer");
  });
});

describe("parseMaterial", () => {
  it("trims a valid reply", () => {
    expect(parseMaterial("  # CV\nbody  ")).toBe("# CV\nbody");
  });
  it("throws on an empty/whitespace reply", () => {
    expect(() => parseMaterial("   \n  ")).toThrow();
  });
});
