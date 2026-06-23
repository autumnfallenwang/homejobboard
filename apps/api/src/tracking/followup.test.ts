import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JobRow } from "../db/queries.js";

const mockChat = vi.fn();
vi.mock("../services/llm-client.js", () => ({
  chatCompletion: (...a: unknown[]) => mockChat(...a),
}));
vi.mock("../services/settings.js", () => ({
  getSettingOr: (_db: unknown, key: string) =>
    Promise.resolve(
      {
        cv: "# Jane Doe\nCut p95 latency 38% at Stripe.",
        fitness_profile: "remote only",
        llm_model_materials: "primary-model",
        llm_model_materials_fallback: "fallback-model",
      }[key] ?? "",
    ),
}));

const { generateFollowUp, buildFollowUpPrompt } = await import("./followup.js");

const job = (over: Partial<JobRow> = {}): JobRow =>
  ({
    id: "j1",
    title: "Staff Engineer",
    company: "Acme",
    description: "Build.",
    status: "applied",
    appliedAt: new Date("2026-06-10T00:00:00.000Z"),
    followUpCount: 0,
    ...over,
  }) as JobRow;

describe("buildFollowUpPrompt", () => {
  it("includes the status and days-since-applied", () => {
    const p = buildFollowUpPrompt(job(), "# Jane Doe", "remote", {
      status: "applied",
      daysSinceApplied: 9,
      followUpCount: 0,
    });
    expect(p).toContain("Current status: applied");
    expect(p).toContain("Days since applied: 9");
    expect(p).toContain("Staff Engineer");
  });
});

describe("generateFollowUp", () => {
  beforeEach(() => mockChat.mockReset());

  it("returns the draft from the primary model", async () => {
    mockChat.mockResolvedValueOnce("Subject: Following up\n\nHi…");
    const r = await generateFollowUp({} as never, job());
    expect(r).toMatchObject({ model: "primary-model" });
    expect(r.content).toContain("Subject:");
  });

  it("falls back when the primary throws", async () => {
    mockChat.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("Subject: Hi");
    const r = await generateFollowUp({} as never, job());
    expect(r).toMatchObject({ model: "fallback-model" });
    expect(mockChat).toHaveBeenCalledTimes(2);
  });
});
