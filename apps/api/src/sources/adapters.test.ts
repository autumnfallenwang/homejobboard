import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAshby } from "./ashby.js";
import { parseGreenhouse } from "./greenhouse.js";
import { parseHnComments, pickHiringStory } from "./hn.js";
import { parseLever } from "./lever.js";
import { parseRecruitee } from "./recruitee.js";
import { parseRemoteOk } from "./remoteok.js";
import { parseRemotive } from "./remotive.js";
import { parseSmartRecruiters } from "./smartrecruiters.js";
import { parseWorkableMarkdown } from "./workable.js";
import { detectWorkday, parseWorkday } from "./workday.js";

const load = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./__fixtures__/${name}.json`, import.meta.url), "utf-8"));
const loadText = (name: string): string =>
  readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf-8");

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

describe("parseAshby", () => {
  it("maps listed jobs, extracts salary + workplace, drops unlisted", () => {
    const out = parseAshby(load("ashby") as never, "openai");
    expect(out).toHaveLength(2); // unlisted req dropped
    expect(out[0]).toMatchObject({
      source: "ashby:openai",
      sourceJobId: "8fb1615c-34bf-47c4-a1d1-b7b2f836bbd3",
      title: "Software Engineer, Infrastructure",
      company: "openai",
      location: "San Francisco",
      workplaceType: "hybrid",
      postedAt: "2026-06-02T16:38:15.322+00:00",
      salaryMin: 257000,
      salaryMax: 335000,
      employmentType: "FullTime",
      tags: ["Engineering", "Platform"],
    });
    expect(out[0]?.description).toContain("GPU fleet");
    // isRemote fallback + descriptionPlain fallback, equity-only comp ignored
    expect(out[1]).toMatchObject({
      workplaceType: "remote",
      salaryMin: null,
      description: "Plain-text fallback description.",
    });
  });
});

describe("parseHnComments / pickHiringStory", () => {
  const fixture = load("hn") as { storyId: number; hits: never[] };

  it("keeps only top-level, pipe-formatted comments and parses the headline", () => {
    const out = parseHnComments(fixture.hits, fixture.storyId);
    expect(out).toHaveLength(2); // reply + chatter dropped
    expect(out[0]).toMatchObject({
      source: "hn",
      sourceJobId: "48451409",
      url: "https://news.ycombinator.com/item?id=48451409",
      company: "focal vc",
      title: "Head of Tech & AI",
      location: "Remote/Onsite/Hybrid (US)",
      workplaceType: "remote",
      postedAt: "2026-06-08T20:26:13Z",
    });
    expect(out[1]).toMatchObject({
      company: "Acme Robotics",
      title: "Senior Backend Engineer",
      location: "Boston, MA (onsite)",
      workplaceType: null,
    });
    expect(out[1]?.description).toContain("warehouse robots");
  });

  it("picks the latest hiring story by title", () => {
    expect(
      pickHiringStory([
        { objectID: "1", title: "Ask HN: Who wants to be hired? (June 2026)" },
        { objectID: "48357725", title: "Ask HN: Who is hiring? (June 2026)" },
      ] as never[]),
    ).toBe(48357725);
    expect(pickHiringStory([])).toBeNull();
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

const WD_CFG = { tenant: "nvidia", instance: "wd5", site: "NVIDIAExternalCareerSite" };

describe("detectWorkday", () => {
  it("parses tenant/instance/site from a careers URL (with and without locale)", () => {
    expect(
      detectWorkday("https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite"),
    ).toEqual(WD_CFG);
    expect(detectWorkday("https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite")).toEqual(
      WD_CFG,
    );
  });
  it("returns null for a non-Workday URL", () => {
    expect(detectWorkday("https://boards.greenhouse.io/stripe")).toBeNull();
  });
});

describe("parseWorkday", () => {
  it("maps CXS postings and resolves relative postedOn against now", () => {
    const now = new Date("2026-06-22T12:00:00.000Z");
    const out = parseWorkday(load("workday") as never, WD_CFG, "NVIDIA", now);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      source: "workday:nvidia",
      sourceJobId: "/job/US-CA-Santa-Clara/Senior-Software-Engineer--Platform_JR1993456",
      url: "https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/job/US-CA-Santa-Clara/Senior-Software-Engineer--Platform_JR1993456",
      title: "Senior Software Engineer, Platform",
      company: "NVIDIA",
      location: "US, CA, Santa Clara",
      workplaceType: null,
      postedAt: "2026-06-22T12:00:00.000Z", // "Posted Today" → now
    });
    expect(out[1]?.postedAt).toBeNull(); // "Posted 30+ Days Ago" → unbounded
    expect(out[1]?.workplaceType).toBe("remote"); // "US, Remote"
  });
});

describe("parseSmartRecruiters", () => {
  it("maps content[], rewrites ref to the public URL, synthesizes a fallback", () => {
    const out = parseSmartRecruiters(load("smartrecruiters") as never, "Square", "Block");
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      source: "smartrecruiters:Square",
      sourceJobId: "744000000123456",
      url: "https://jobs.smartrecruiters.com/Square/postings/744000000123456",
      title: "Senior Backend Engineer",
      company: "Block",
      location: "San Francisco, California, us",
      workplaceType: null,
      postedAt: "2026-06-10T00:00:00.000Z",
    });
    expect(out[1]).toMatchObject({
      url: "https://jobs.smartrecruiters.com/Square/744000000654321", // ref absent → synthesized
      workplaceType: "remote",
      postedAt: "2026-06-08T12:30:00.000Z", // releasedDate null → createdOn
    });
  });
});

describe("parseRecruitee", () => {
  it("synthesizes the canonical recruitee.com URL, normalizes dates, drops slug-less offers", () => {
    const out = parseRecruitee(load("recruitee") as never, "acme", "Acme");
    expect(out).toHaveLength(2); // slug-less / bad-scheme offer dropped
    expect(out[0]).toMatchObject({
      source: "recruitee:acme",
      sourceJobId: "101",
      url: "https://acme.recruitee.com/o/senior-platform-engineer",
      applyUrl: "https://acme.recruitee.com/o/senior-platform-engineer/c/new",
      title: "Senior Platform Engineer",
      company: "Acme",
      location: "Berlin, Germany",
      workplaceType: "hybrid",
      employmentType: "fulltime",
      postedAt: "2026-06-12T10:00:00.000Z", // "2026-06-12 10:00:00 UTC" → ISO
    });
    expect(out[0]?.description).toContain("platform infrastructure");
    // Custom branded careers domain: canonical URL stays on recruitee.com (safe),
    // the branded URL is kept only as the client-opened applyUrl.
    expect(out[1]).toMatchObject({
      sourceJobId: "102",
      url: "https://acme.recruitee.com/o/staff-backend-engineer",
      applyUrl: "https://jobs.brandco.com/o/staff-backend-engineer/c/new",
      workplaceType: "remote",
      postedAt: "2026-06-11T08:30:00.000Z",
    });
  });
});

describe("parseWorkableMarkdown", () => {
  it("parses the table and skips a [View] link off apply.workable.com", () => {
    const out = parseWorkableMarkdown(loadText("workable.md"), "acme", "Acme");
    expect(out).toHaveLength(2); // off-domain row skipped
    expect(out[0]).toMatchObject({
      source: "workable:acme",
      sourceJobId: "ABCD1234",
      url: "https://apply.workable.com/acme/j/ABCD1234",
      title: "Senior Frontend Engineer",
      company: "Acme",
      location: "Remote (US)",
      workplaceType: "remote",
      postedAt: "2026-06-15T00:00:00.000Z",
    });
    expect(out[1]).toMatchObject({ sourceJobId: "EFGH5678", workplaceType: null });
  });
});
