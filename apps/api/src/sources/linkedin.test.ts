import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLinkedInDetail, parseLinkedInList } from "./linkedin.js";

const listHtml = readFileSync(
  new URL("./__fixtures__/linkedin-list.html", import.meta.url),
  "utf-8",
);
const detailHtml = readFileSync(
  new URL("./__fixtures__/linkedin-detail.html", import.meta.url),
  "utf-8",
);

describe("parseLinkedInList", () => {
  const out = parseLinkedInList(listHtml);

  it("parses job cards with identity + freshness fields", () => {
    expect(out.length).toBeGreaterThan(0);
    const first = out[0]!;
    expect(first.source).toBe("linkedin");
    expect(first.sourceJobId).toMatch(/^\d+$/);
    expect(first.title.length).toBeGreaterThan(0);
    expect(first.company.length).toBeGreaterThan(0);
    expect(first.url).toContain("linkedin.com/jobs/view/");
    expect(first.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("leaves description null (stage-1 only)", () => {
    expect(out[0]?.description).toBeNull();
  });
});

describe("parseLinkedInDetail", () => {
  const detail = parseLinkedInDetail(detailHtml);

  it("extracts the full description and criteria", () => {
    expect(detail.description).toBeTruthy();
    expect((detail.description ?? "").length).toBeGreaterThan(50);
    expect(detail.employmentType).toBeTruthy();
    expect(detail.seniority).toBeTruthy();
  });
});
