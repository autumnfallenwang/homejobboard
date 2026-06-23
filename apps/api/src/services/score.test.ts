import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobRow } from "../db/queries.js";

const mockChat = vi.fn();
vi.mock("./llm-client.js", () => ({ chatCompletion: (...a: unknown[]) => mockChat(...a) }));
vi.mock("./settings.js", () => ({
  getSettingOr: (_db: unknown, key: string) =>
    Promise.resolve(
      {
        fitness_profile: "Senior TS engineer, remote.",
        llm_model_fitness: "primary-model",
        llm_model_fitness_fallback: "fallback-model",
      }[key] ?? "",
    ),
}));

const { scoreJob } = await import("./score.js");

const verdict = {
  recommendation: "apply",
  subScores: { skills: 5, seniority: 4, domain: 4, compensation: 3, logistics: 5 },
  topStrengths: ["stack match"],
  hardStops: [],
  softGaps: [],
  rationale: "Good fit.",
  confidence: "high",
};
const reply = (fitness: number) => JSON.stringify({ fitness, verdict });

const job = (over: Partial<JobRow> = {}): JobRow =>
  ({
    id: "j1",
    title: "Staff Engineer",
    company: "Acme",
    location: "Remote",
    description: "Build platform in TypeScript.",
    workplaceType: "remote",
    employmentType: "Full-time",
    ...over,
  }) as JobRow;

describe("scoreJob", () => {
  beforeEach(() => mockChat.mockReset());

  it("returns the parsed fitness + verdict from the primary model", async () => {
    mockChat.mockResolvedValueOnce(reply(73));
    const r = await scoreJob({} as never, job());
    expect(r).toMatchObject({ fitness: 73, model: "primary-model" });
    expect(r.verdict.recommendation).toBe("apply");
  });

  it("falls back to the fallback model when the primary throws", async () => {
    mockChat.mockRejectedValueOnce(new Error("primary down")).mockResolvedValueOnce(reply(40));
    const r = await scoreJob({} as never, job());
    expect(r).toMatchObject({ fitness: 40, model: "fallback-model" });
    expect(mockChat).toHaveBeenCalledTimes(2);
  });

  it("falls back when the primary returns malformed JSON (fails closed)", async () => {
    mockChat.mockResolvedValueOnce("not json at all").mockResolvedValueOnce(reply(55));
    const r = await scoreJob({} as never, job());
    expect(r).toMatchObject({ fitness: 55, model: "fallback-model" });
  });
});
