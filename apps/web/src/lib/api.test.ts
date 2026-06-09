import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl, listFeed, setJobStatus } from "./api.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("apiBaseUrl", () => {
  it("falls back to the local dev API port", () => {
    expect(apiBaseUrl()).toBe("http://localhost:3001");
  });
});

describe("listFeed", () => {
  it("parses a 2xx array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ id: "j1" }]), { status: 200 })),
    );
    await expect(listFeed({ sort: "rank" })).resolves.toEqual([{ id: "j1" }]);
  });
});

describe("setJobStatus", () => {
  it("issues a PATCH with the status body", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(JSON.stringify({ id: "j1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await setJobStatus("j1", "applied");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBe(JSON.stringify({ status: "applied" }));
  });

  it("throws ApiClientError with the typed body on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "not found" }), { status: 404 })),
    );
    await expect(setJobStatus("nope", "applied")).rejects.toMatchObject({
      name: "ApiClientError",
      status: 404,
    });
  });
});
