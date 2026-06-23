import { describe, expect, it } from "vitest";
import { jobFiltersSchema, matchesFilters, parsePostedSince } from "./filters.js";

const NOW = new Date("2026-06-10T12:00:00Z");

const job = (over: Partial<Parameters<typeof matchesFilters>[0]> = {}) => ({
  title: "Senior Backend Engineer",
  company: "Acme",
  location: "Boston, MA",
  workplaceType: null,
  postedAt: "2026-06-10T09:00:00Z",
  tags: ["typescript", "node"],
  description: "Build APIs in TypeScript and Postgres.",
  ...over,
});

describe("parsePostedSince", () => {
  it("parses m/h/d windows", () => {
    expect(parsePostedSince("30m")).toBe(30 * 60_000);
    expect(parsePostedSince("24h")).toBe(24 * 3_600_000);
    expect(parsePostedSince("7d")).toBe(7 * 86_400_000);
  });

  it("returns null for absent or malformed windows", () => {
    expect(parsePostedSince(undefined)).toBeNull();
    expect(parsePostedSince("soon")).toBeNull();
    expect(parsePostedSince("-3d")).toBeNull();
  });
});

describe("matchesFilters", () => {
  const f = (over: object = {}) => jobFiltersSchema.parse(over);

  it("passes everything on empty filters", () => {
    expect(matchesFilters(job(), f(), NOW)).toBe(true);
  });

  it("requires at least one keyword across title/company/tags/description", () => {
    expect(matchesFilters(job(), f({ keywords: ["backend"] }), NOW)).toBe(true);
    expect(matchesFilters(job(), f({ keywords: ["postgres"] }), NOW)).toBe(true); // description
    expect(matchesFilters(job(), f({ keywords: ["rust", "golang"] }), NOW)).toBe(false);
  });

  it("drops on excludeKeywords in title/company/tags but not description", () => {
    expect(matchesFilters(job(), f({ excludeKeywords: ["backend"] }), NOW)).toBe(false);
    expect(matchesFilters(job(), f({ excludeKeywords: ["postgres"] }), NOW)).toBe(true);
  });

  it("location is a substring match; remote and unknown-location jobs pass", () => {
    expect(matchesFilters(job(), f({ location: "boston" }), NOW)).toBe(true);
    expect(matchesFilters(job(), f({ location: "denver" }), NOW)).toBe(false);
    expect(matchesFilters(job({ location: null }), f({ location: "denver" }), NOW)).toBe(true);
    expect(
      matchesFilters(
        job({ workplaceType: "remote", location: "Anywhere" }),
        f({ location: "denver" }),
        NOW,
      ),
    ).toBe(true);
  });

  it("workplaceType must match when the job declares one", () => {
    expect(
      matchesFilters(job({ workplaceType: "onsite" }), f({ workplaceType: "remote" }), NOW),
    ).toBe(false);
    expect(matchesFilters(job({ workplaceType: null }), f({ workplaceType: "remote" }), NOW)).toBe(
      true,
    );
  });

  it("postedSince drops stale jobs but passes unknown postedAt", () => {
    expect(matchesFilters(job(), f({ postedSince: "24h" }), NOW)).toBe(true);
    expect(
      matchesFilters(job({ postedAt: "2026-06-01T00:00:00Z" }), f({ postedSince: "24h" }), NOW),
    ).toBe(false);
    expect(matchesFilters(job({ postedAt: null }), f({ postedSince: "24h" }), NOW)).toBe(true);
  });
});
