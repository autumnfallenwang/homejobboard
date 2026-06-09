import { describe, expect, it } from "vitest";
import { formatRelativeTime, plainText, scoreColor } from "./format.js";

const now = new Date("2026-06-08T12:00:00Z");

describe("formatRelativeTime", () => {
  it("buckets minutes/hours/days", () => {
    expect(formatRelativeTime("2026-06-08T11:59:40Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-06-08T09:00:00Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2026-06-06T12:00:00Z", now)).toBe("2d ago");
    expect(formatRelativeTime(null, now)).toBe("");
  });
});

describe("scoreColor", () => {
  it("maps bands", () => {
    expect(scoreColor(85)).toContain("emerald");
    expect(scoreColor(65)).toBe("text-foreground");
    expect(scoreColor(45)).toContain("amber");
    expect(scoreColor(10)).toBe("text-muted");
  });
});

describe("plainText", () => {
  it("strips tags, decodes entities, keeps breaks", () => {
    const out = plainText("<p>Hello &amp; welcome</p><p>Line&nbsp;2</p>");
    expect(out).toContain("Hello & welcome");
    expect(out).toContain("Line 2");
    expect(out).not.toContain("<p>");
  });

  it("turns list items into bullets", () => {
    expect(plainText("<ul><li>one</li><li>two</li></ul>")).toContain("• one");
  });
});
