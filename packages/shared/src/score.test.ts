import { describe, expect, it } from "vitest";
import { composite, freshness } from "./score.js";

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
