import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseWwr } from "./wwr.js";

const xml = readFileSync(new URL("./__fixtures__/wwr.xml", import.meta.url), "utf-8");

describe("parseWwr", () => {
  const out = parseWwr(xml);

  it("parses both items", () => {
    expect(out).toHaveLength(2);
  });

  it('splits "Company: Role" titles and marks remote', () => {
    expect(out[0]).toMatchObject({
      source: "wwr",
      company: "Yei Finance",
      title: "Product Manager",
      workplaceType: "remote",
      employmentType: "Full-Time",
    });
    expect(out[0]?.sourceJobId).toBe("yei-finance-product-manager");
  });

  it("converts pubDate to ISO and carries the description", () => {
    expect(out[0]?.postedAt).toBe(new Date("Mon, 08 Jun 2026 20:31:06 +0000").toISOString());
    expect(out[0]?.description).toContain("Clovis");
  });
});
