import { describe, expect, it } from "vitest";
import {
  descriptionBlocks,
  formatRelativeTime,
  formatSalary,
  plainText,
  scoreColor,
} from "./format.js";

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
  it("maps bands to theme tokens", () => {
    expect(scoreColor(85)).toBe("text-success");
    expect(scoreColor(65)).toBe("text-foreground");
    expect(scoreColor(45)).toBe("text-warn");
    expect(scoreColor(10)).toBe("text-muted");
  });
});

describe("formatSalary", () => {
  it("formats ranges, open ends, and unknowns", () => {
    expect(formatSalary(120000, 170000)).toBe("$120k–$170k");
    expect(formatSalary(150000, null)).toBe("$150k+");
    expect(formatSalary(null, 90000)).toBe("up to $90k");
    expect(formatSalary(200000, 200000)).toBe("$200k");
    expect(formatSalary(null, null)).toBe("");
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

describe("descriptionBlocks", () => {
  it("classifies headings, bullets, and paragraphs", () => {
    const blocks = descriptionBlocks(
      "<h3>About the Team</h3><p>We build robots for warehouses everywhere.</p><ul><li>Ship code</li></ul>",
    );
    expect(blocks).toEqual([
      { type: "h", text: "About the Team" },
      { type: "p", text: "We build robots for warehouses everywhere." },
      { type: "li", text: "Ship code" },
    ]);
  });

  it("returns [] for empty input", () => {
    expect(descriptionBlocks(null)).toEqual([]);
  });
});
