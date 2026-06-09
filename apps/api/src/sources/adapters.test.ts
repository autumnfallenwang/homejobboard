import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseGreenhouse } from "./greenhouse.js";
import { parseLever } from "./lever.js";
import { parseRemoteOk } from "./remoteok.js";
import { parseRemotive } from "./remotive.js";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf-8"));

describe("parseGreenhouse", () => {
  it("maps board jobs to normalized summaries", () => {
    const out = parseGreenhouse(load("greenhouse") as never, "stripe");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      source: "greenhouse:stripe",
      sourceJobId: "7532733",
      title: "Account Executive, AI Sales",
      company: "Stripe",
      location: "San Francisco, CA",
      postedAt: "2026-06-01T09:00:00-04:00",
    });
    expect(out[0]?.description).toContain("Sell AI");
  });
});

describe("parseLever", () => {
  it("maps postings and converts epoch-ms createdAt to ISO", () => {
    const out = parseLever(load("lever") as never, "spotify");
    expect(out[0]).toMatchObject({
      source: "lever:spotify",
      title: "Accounts Payable Analyst",
      company: "spotify",
      location: "New York, NY",
      employmentType: "Permanent",
    });
    expect(out[0]?.postedAt).toBe(new Date(1778529611285).toISOString());
  });
});

describe("parseRemoteOk", () => {
  it("drops the legal element and normalizes salary 0 to null", () => {
    const out = parseRemoteOk(load("remoteok") as never);
    expect(out).toHaveLength(2); // element[0] legal notice dropped
    expect(out[0]).toMatchObject({
      source: "remoteok",
      title: "Medical Claims Processor I",
      workplaceType: "remote",
    });
    expect(out[0]?.salaryMin).toBeNull(); // 0 → null
    expect(out[1]?.salaryMin).toBe(120000);
  });
});

describe("parseRemotive", () => {
  it("maps the jobs array with remote workplace type", () => {
    const out = parseRemotive(load("remotive") as never);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      source: "remotive",
      company: "TELUS Digital",
      employmentType: "part_time",
      workplaceType: "remote",
    });
  });
});
