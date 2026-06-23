import { dedupKey } from "@homejobboard/shared";
import { describe, expect, it } from "vitest";
import { type DedupRow, markDuplicates } from "./dedup.js";

const row = (id: string, source: string, dedupKey: string, t: number, title = ""): DedupRow => ({
  id,
  source,
  dedupKey,
  title,
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

describe("markDuplicates (fuzzy role matching)", () => {
  it("collapses a cross-source Senior X / X pair at the same company+location", () => {
    const map = markDuplicates([
      row(
        "gh",
        "greenhouse:acme",
        dedupKey("Acme", "Senior Data Platform Engineer", "Berlin"),
        100,
        "Senior Data Platform Engineer",
      ),
      row(
        "li",
        "linkedin",
        dedupKey("Acme", "Data Platform Engineer", "Berlin"),
        200,
        "Data Platform Engineer",
      ),
    ]);
    expect(map.get("li")).toBe("gh");
    expect(map.has("gh")).toBe(false);
  });

  it("keeps generic siblings apart (only baseline tokens overlap)", () => {
    const map = markDuplicates([
      row(
        "a",
        "greenhouse:acme",
        dedupKey("Acme", "Senior Software Engineer", "Berlin"),
        100,
        "Senior Software Engineer",
      ),
      row(
        "b",
        "linkedin",
        dedupKey("Acme", "Software Engineer", "Berlin"),
        200,
        "Software Engineer",
      ),
    ]);
    expect(map.size).toBe(0);
  });

  it("keeps different specialties apart at the same company", () => {
    const map = markDuplicates([
      row(
        "a",
        "greenhouse:acme",
        dedupKey("Acme", "Backend Engineer", "Berlin"),
        100,
        "Backend Engineer",
      ),
      row(
        "b",
        "linkedin",
        dedupKey("Acme", "Frontend Engineer", "Berlin"),
        200,
        "Frontend Engineer",
      ),
    ]);
    expect(map.size).toBe(0);
  });
});
