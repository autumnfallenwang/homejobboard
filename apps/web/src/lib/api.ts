// HTTP client for the Hono backend — the web's transport layer.
// M01 is the minimal seed: a dual-context base URL + a /health probe.
// Typed entity calls (jobs, sources, filters) land from M03/M05.

/**
 * Dual-context base URL:
 * - Server (SSR): `API_URL` (in-cluster Service DNS) → `NEXT_PUBLIC_API_URL`.
 * - Browser: `NEXT_PUBLIC_API_URL` (public ingress, baked at build).
 * Falls back to the local dev API port.
 */
export function apiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export interface HealthResponse {
  status: string;
}

/** Probe the API's /health endpoint. Throws on a non-2xx response. */
export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${apiBaseUrl()}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API /health returned ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}
