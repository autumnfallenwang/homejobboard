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

const { buildFitnessPrompt, parseFitnessResult, scoreJob } = await import("./score.js");

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

describe("buildFitnessPrompt", () => {
  it("includes the profile and the job title", () => {
    const p = buildFitnessPrompt(job(), "Senior TS engineer, remote.");
    expect(p).toContain("Senior TS engineer");
    expect(p).toContain("Staff Engineer");
  });
});

describe("parseFitnessResult", () => {
  it("parses a clean JSON result", () => {
    expect(parseFitnessResult('{"fitness": 87, "reasons": ["stack match"]}')).toEqual({
      fitness: 87,
      reasons: ["stack match"],
    });
  });

  it("tolerates markdown-wrapped JSON", () => {
    const r = parseFitnessResult('```json\n{"fitness": 50, "reasons": []}\n```');
    expect(r.fitness).toBe(50);
  });

  it("rejects out-of-range fitness", () => {
    expect(() => parseFitnessResult('{"fitness": 150}')).toThrow();
  });
});

describe("scoreJob", () => {
  beforeEach(() => mockChat.mockReset());

  it("returns the parsed result from the primary model", async () => {
    mockChat.mockResolvedValueOnce('{"fitness": 73, "reasons": ["good fit"]}');
    const r = await scoreJob({} as never, job());
    expect(r).toMatchObject({ fitness: 73, model: "primary-model" });
  });

  it("falls back to the fallback model when the primary throws", async () => {
    mockChat
      .mockRejectedValueOnce(new Error("primary down"))
      .mockResolvedValueOnce('{"fitness": 40}');
    const r = await scoreJob({} as never, job());
    expect(r).toMatchObject({ fitness: 40, model: "fallback-model" });
    expect(mockChat).toHaveBeenCalledTimes(2);
  });
});
