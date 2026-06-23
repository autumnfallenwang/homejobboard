import { describe, expect, it } from "vitest";
import { checkLiveness, classifyLiveness } from "./liveness.js";

const HEALTHY_BODY = `About the role. ${"We are hiring engineers to build the platform. ".repeat(20)}`;

describe("classifyLiveness", () => {
  it("classifies HTTP 404/410 as expired", () => {
    expect(classifyLiveness({ status: 404, bodyText: HEALTHY_BODY })).toMatchObject({
      result: "expired",
      code: "http_gone",
    });
  });

  it("classifies a hard-expired banner as expired (over a generic Apply string)", () => {
    expect(
      classifyLiveness({
        status: 200,
        bodyText: "This job is no longer available. Apply to other roles.",
      }),
    ).toMatchObject({ result: "expired", code: "expired_body" });
  });

  it("classifies an anti-bot interstitial as uncertain, not expired", () => {
    expect(
      classifyLiveness({ status: 403, bodyText: "Just a moment... checking your browser." }),
    ).toMatchObject({ result: "uncertain", code: "bot_challenge" });
  });

  it("classifies a too-short body as expired (insufficient content)", () => {
    expect(classifyLiveness({ status: 200, bodyText: "Home · Careers" })).toMatchObject({
      result: "expired",
      code: "insufficient_content",
    });
  });

  it("classifies a visible apply control as active", () => {
    expect(
      classifyLiveness({ status: 200, bodyText: HEALTHY_BODY, applyControls: ["Apply now"] }),
    ).toMatchObject({ result: "active", code: "apply_control_visible" });
  });

  it("defaults to uncertain when content is present but no apply control is seen", () => {
    expect(classifyLiveness({ status: 200, bodyText: HEALTHY_BODY })).toMatchObject({
      result: "uncertain",
      code: "no_apply_control",
    });
  });
});

describe("checkLiveness", () => {
  const fakeFetch = (body: string, status: number): typeof fetch =>
    (async () => new Response(body, { status })) as typeof fetch;

  it("drops a known-expired posting", async () => {
    const res = await checkLiveness("https://example.com/job/1", {
      fetchImpl: fakeFetch("This position has been filled.", 200),
    });
    expect(res.result).toBe("expired");
  });

  it("keeps a reachable posting (not expired)", async () => {
    const res = await checkLiveness("https://example.com/job/2", {
      fetchImpl: fakeFetch(HEALTHY_BODY, 200),
    });
    expect(res.result).not.toBe("expired");
  });

  it("treats a network error as uncertain, never expired", async () => {
    const failing = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    const res = await checkLiveness("https://example.com/job/3", { fetchImpl: failing });
    expect(res).toMatchObject({ result: "uncertain", code: "fetch_error" });
  });
});
