import { describe, expect, it } from "vitest";
import { computeNextFollowUpAt, computeUrgency, daysBetween, followUpInfo } from "./cadence.js";

const now = new Date("2026-06-23T00:00:00.000Z");
const daysAgo = (n: number): Date => new Date(now.getTime() - n * 86_400_000);

describe("computeUrgency", () => {
  it("applied: overdue past the 7-day window, waiting before it, cold at max follow-ups", () => {
    expect(computeUrgency("applied", 8, null, 0)).toBe("overdue");
    expect(computeUrgency("applied", 3, null, 0)).toBe("waiting");
    expect(computeUrgency("applied", 30, null, 2)).toBe("cold"); // hit applied_max_followups
    expect(computeUrgency("applied", 3, 9, 1)).toBe("overdue"); // 2nd follow-up due
  });
  it("responded is urgent immediately, overdue after a few days; interview overdue after 1d", () => {
    expect(computeUrgency("responded", 0, null, 0)).toBe("urgent");
    expect(computeUrgency("responded", 4, null, 0)).toBe("overdue");
    expect(computeUrgency("interview", 2, null, 0)).toBe("overdue");
  });
  it("statuses without cadence are 'waiting'", () => {
    expect(computeUrgency("offer", 100, null, 0)).toBe("waiting");
  });
});

describe("computeNextFollowUpAt", () => {
  const ref = new Date("2026-06-10T00:00:00.000Z");
  it("applied → ref + 7d; responded → ref + 3d; interview → ref + 1d; offer → null", () => {
    expect(computeNextFollowUpAt("applied", ref, null, 0)?.toISOString()).toBe(
      "2026-06-17T00:00:00.000Z",
    );
    expect(computeNextFollowUpAt("responded", ref, null, 0)?.toISOString()).toBe(
      "2026-06-13T00:00:00.000Z",
    );
    expect(computeNextFollowUpAt("interview", ref, null, 0)?.toISOString()).toBe(
      "2026-06-11T00:00:00.000Z",
    );
    expect(computeNextFollowUpAt("offer", ref, null, 0)).toBeNull();
    expect(computeNextFollowUpAt("applied", ref, null, 2)).toBeNull(); // cold
  });
});

describe("followUpInfo", () => {
  it("flags an overdue applied job and uses appliedAt as the reference", () => {
    const info = followUpInfo(
      {
        status: "applied",
        appliedAt: daysAgo(8),
        statusChangedAt: daysAgo(8),
        lastFollowUpAt: null,
        followUpCount: 0,
      },
      now,
    );
    expect(info).not.toBeNull();
    expect(info?.overdue).toBe(true);
    expect(info?.urgency).toBe("overdue");
  });

  it("returns null for statuses without a cadence (e.g. offer)", () => {
    expect(
      followUpInfo(
        {
          status: "offer",
          appliedAt: daysAgo(30),
          statusChangedAt: daysAgo(2),
          lastFollowUpAt: null,
          followUpCount: 0,
        },
        now,
      ),
    ).toBeNull();
  });
});

describe("daysBetween", () => {
  it("floors to whole days", () => {
    expect(daysBetween(daysAgo(3), now)).toBe(3);
  });
});
