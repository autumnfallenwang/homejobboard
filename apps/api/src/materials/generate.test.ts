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
        cv: "# Jane Doe\nStaff engineer.",
        fitness_profile: "remote only",
        llm_model_materials: "primary-model",
        llm_model_materials_fallback: "fallback-model",
      }[key] ?? "",
    ),
}));

const { generateMaterial } = await import("./generate.js");

const job = (): JobRow =>
  ({ id: "j1", title: "Staff Engineer", company: "Acme", description: "Build." }) as JobRow;

describe("generateMaterial", () => {
  beforeEach(() => mockChat.mockReset());

  it("returns content from the primary model", async () => {
    mockChat.mockResolvedValueOnce("# Jane Doe\nTailored CV body.");
    const r = await generateMaterial({} as never, job(), "cv");
    expect(r).toEqual({ content: "# Jane Doe\nTailored CV body.", model: "primary-model" });
  });

  it("falls back to the fallback model when the primary throws", async () => {
    mockChat
      .mockRejectedValueOnce(new Error("primary down"))
      .mockResolvedValueOnce("Dear team, ...");
    const r = await generateMaterial({} as never, job(), "cover");
    expect(r).toMatchObject({ model: "fallback-model" });
    expect(mockChat).toHaveBeenCalledTimes(2);
  });

  it("falls back when the primary returns an empty reply (fails closed)", async () => {
    mockChat.mockResolvedValueOnce("   ").mockResolvedValueOnce("# CV\nbody");
    const r = await generateMaterial({} as never, job(), "cv");
    expect(r).toMatchObject({ content: "# CV\nbody", model: "fallback-model" });
  });
});
