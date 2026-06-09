// Shared fetch helpers for source adapters. Polite browser UA, bounded timeout,
// throw on non-2xx. Adapters call these in their `search()`; unit tests never do
// (they exercise the pure `parse*` functions on fixtures).

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const DEFAULT_TIMEOUT_MS = 25_000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": UA, ...init?.headers },
    });
    if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(url, init);
  return (await res.json()) as T;
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetchWithTimeout(url, init);
  return res.text();
}
