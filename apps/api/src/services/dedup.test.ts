import { describe, expect, it } from "vitest";
import { type DedupRow, markDuplicates } from "./dedup.js";

const row = (id: string, source: string, dedupKey: string, t: number): DedupRow => ({
  id,
  source,
  dedupKey,
  fetchedAt: new Date(t),
});

describe("markDuplicates", () => {
  it("leaves a unique key untouched", () => {
    const map = markDuplicates([row("a", "remoteok", "k1", 1)]);
    expect(map.size).toBe(0);
  });

  it("does not collapse repeats within a single source", () => {
    const map = markDuplicates([row("a", "remoteok", "k1", 1), row("b", "remoteok", "k1", 2)]);
    expect(map.size).toBe(0);
  });

  it("marks the later cross-source row as a duplicate of the earlier", () => {
    const map = markDuplicates([
      row("late", "remotive", "k1", 200),
      row("early", "remoteok", "k1", 100),
    ]);
    expect(map.get("late")).toBe("early");
    expect(map.has("early")).toBe(false);
  });

  it("picks one canonical for 3 sources sharing a key", () => {
    const map = markDuplicates([
      row("a", "remoteok", "k1", 100),
      row("b", "remotive", "k1", 200),
      row("c", "greenhouse:x", "k1", 300),
    ]);
    expect(map.get("b")).toBe("a");
    expect(map.get("c")).toBe("a");
    expect(map.has("a")).toBe(false);
  });
});
