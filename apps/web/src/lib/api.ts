// Typed HTTP client for the Hono backend. Server components call the read fns;
// client components call the mutations. Mirrors the homework house pattern.

import type { CreateSource, Job, JobScore, JobStatus, SourceConfig } from "@homejobboard/shared";

/** A job as returned by the feed/detail endpoints: the row plus its score (nullable). */
export type FeedJob = Job & { score: JobScore | null; rank?: number };
/** The detail endpoint adds the duplicate listings folded into this job. */
export type JobDetailResponse = FeedJob & {
  alsoSeenOn: Array<{ id: string; source: string; url: string }>;
};
export type SettingRow = { key: string; value: string };
export type FeedStats = {
  new: number;
  applied: number;
  dismissed: number;
  unscored: number;
  lastPolledAt: string | null;
};

/**
 * Dual-context base URL: server (SSR) prefers in-cluster `API_URL`, browser uses the
 * public `NEXT_PUBLIC_API_URL`; both fall back to the local dev API port.
 */
export function apiBaseUrl(): string {
  if (typeof window === "undefined") {
    return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  }
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.error);
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    let body: ApiError;
    try {
      body = (await res.json()) as ApiError;
    } catch {
      body = { error: `HTTP ${res.status}` };
    }
    throw new ApiClientError(res.status, body);
  }
  return res.json() as Promise<T>;
}

// --- Jobs ---

export interface FeedQuery {
  sort?: "recent" | "rank";
  status?: JobStatus;
  q?: string;
  source?: string;
  minScore?: number;
  limit?: number;
  offset?: number;
}

export function listFeed(q: FeedQuery = {}): Promise<FeedJob[]> {
  const p = new URLSearchParams();
  if (q.sort) p.set("sort", q.sort);
  if (q.status) p.set("status", q.status);
  if (q.q) p.set("q", q.q);
  if (q.source) p.set("source", q.source);
  if (q.minScore != null) p.set("minScore", String(q.minScore));
  if (q.limit != null) p.set("limit", String(q.limit));
  if (q.offset != null) p.set("offset", String(q.offset));
  const qs = p.toString();
  return request<FeedJob[]>(`/jobs${qs ? `?${qs}` : ""}`);
}

export function getJob(id: string): Promise<JobDetailResponse> {
  return request<JobDetailResponse>(`/jobs/${id}`);
}

export function getStats(): Promise<FeedStats> {
  return request<FeedStats>("/stats");
}

export function setJobStatus(id: string, status: JobStatus): Promise<Job> {
  return request<Job>(`/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
}

// --- Sources ---

export function listSources(): Promise<SourceConfig[]> {
  return request<SourceConfig[]>("/sources");
}

export function setSourceEnabled(id: string, enabled: boolean): Promise<SourceConfig> {
  return request<SourceConfig>(`/sources/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export function createSource(input: CreateSource): Promise<SourceConfig> {
  return request<SourceConfig>("/sources", { method: "POST", body: JSON.stringify(input) });
}

export function deleteSource(id: string): Promise<SourceConfig> {
  return request<SourceConfig>(`/sources/${id}`, { method: "DELETE" });
}

// --- Pipeline triggers ---

export function triggerPoll(): Promise<{ inserted: number }> {
  return request<{ inserted: number }>("/poll", { method: "POST", body: "{}" });
}

export function triggerScore(limit?: number): Promise<{ scored: number }> {
  return request<{ scored: number }>("/score", {
    method: "POST",
    body: JSON.stringify(limit != null ? { limit } : {}),
  });
}

// --- Settings ---

export function getSettings(): Promise<SettingRow[]> {
  return request<SettingRow[]>("/settings");
}

export function setSetting(key: string, value: string): Promise<SettingRow> {
  return request<SettingRow>(`/settings/${key}`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}
