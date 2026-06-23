// Job-posting liveness classifier. Pure logic ported from career-ops (MIT)
// `liveness-core.mjs` — expired/anti-bot signals win over a generic "Apply" string.
// `classifyLiveness` is pure (fixture-testable); `checkLiveness` fetches a posting
// (tolerating non-2xx — a 404/410 is the signal) and classifies the response.
// Not yet wired into runPoll: the inline-vs-sweep decision is a follow-up (M07).

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const HARD_EXPIRED_PATTERNS = [
  /job (is )?no longer available/i,
  /job.*no longer open/i,
  /position has been filled/i,
  /this job has expired/i,
  /job posting has expired/i,
  /no longer accepting applications/i,
  /this (position|role|job) (is )?no longer/i,
  /this job (listing )?is closed/i,
  /job (listing )?not found/i,
  /the page you are looking for doesn.t exist/i,
  /applications?\s+(?:(?:have|are|is)\s+)?closed/i,
  /closed on \d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i,
  /closed on (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i,
  /diese stelle (ist )?(nicht mehr|bereits) besetzt/i,
  /offre (expirée|n'est plus disponible)/i,
];

const LISTING_PAGE_PATTERNS = [/\d+\s+jobs?\s+found/i, /search for jobs page is loaded/i];

// Anti-bot interstitials (Cloudflare "Just a moment...", hCaptcha walls) render a
// tiny challenge page instead of the posting. They must NOT read as expired — the
// body is short and lacks an apply control, so without this guard they'd fall to
// `insufficient_content` → expired. Treat as uncertain instead.
const BOT_CHALLENGE_PATTERNS = [
  /just a moment/i,
  /performing security verification/i,
  /checking your browser before/i,
  /verify you are (a |not a )?human/i,
  /enable javascript and cookies to continue/i,
  /attention required.*cloudflare/i,
  /\bray id\b/i,
  /\bcf-ray\b/i,
  /please complete the security check/i,
];

const EXPIRED_URL_PATTERNS = [/[?&]error=true/i];

const APPLY_PATTERNS = [
  /\bapply\b/i,
  /\bsolicitar\b/i,
  /\bbewerben\b/i,
  /\bpostuler\b/i,
  /submit application/i,
  /easy apply/i,
  /start application/i,
  /ich bewerbe mich/i,
  /\baplikuj\b/i,
  /panelu aplikowania/i,
  /wyślij (cv|aplikacj)/i,
];

const MIN_CONTENT_CHARS = 300;

export type LivenessOutcome = "expired" | "active" | "uncertain";

export interface LivenessInput {
  status?: number;
  finalUrl?: string;
  bodyText?: string;
  applyControls?: string[];
}

export interface LivenessResult {
  result: LivenessOutcome;
  code: string;
  reason: string;
}

function firstMatch(patterns: RegExp[], text = ""): RegExp | undefined {
  return patterns.find((pattern) => pattern.test(text));
}

function hasApplyControl(controls: string[] = []): boolean {
  return controls.some((control) => APPLY_PATTERNS.some((pattern) => pattern.test(control)));
}

/** Pure: classify a fetched posting as expired / active / uncertain (first match wins). */
export function classifyLiveness(input: LivenessInput = {}): LivenessResult {
  const { status = 0, finalUrl = "", bodyText = "", applyControls = [] } = input;

  if (status === 404 || status === 410) {
    return { result: "expired", code: "http_gone", reason: `HTTP ${status}` };
  }

  // Anti-bot walls — never expired. Checked before the content-length and
  // listing-page heuristics, which would misread a short challenge body as dead.
  // 403/503 are access-blocked, not "gone" (a removed posting returns 404/410).
  const botChallenge = firstMatch(BOT_CHALLENGE_PATTERNS, bodyText);
  if (botChallenge) {
    return {
      result: "uncertain",
      code: "bot_challenge",
      reason: `anti-bot challenge: ${botChallenge.source}`,
    };
  }
  if (status === 403 || status === 503) {
    return {
      result: "uncertain",
      code: "access_blocked",
      reason: `HTTP ${status} (access blocked, likely anti-bot)`,
    };
  }

  const expiredUrl = firstMatch(EXPIRED_URL_PATTERNS, finalUrl);
  if (expiredUrl) {
    return { result: "expired", code: "expired_url", reason: `redirect to ${finalUrl}` };
  }

  const expiredBody = firstMatch(HARD_EXPIRED_PATTERNS, bodyText);
  if (expiredBody) {
    return {
      result: "expired",
      code: "expired_body",
      reason: `pattern matched: ${expiredBody.source}`,
    };
  }

  if (hasApplyControl(applyControls)) {
    return {
      result: "active",
      code: "apply_control_visible",
      reason: "visible apply control detected",
    };
  }

  const listingPage = firstMatch(LISTING_PAGE_PATTERNS, bodyText);
  if (listingPage) {
    return {
      result: "expired",
      code: "listing_page",
      reason: `pattern matched: ${listingPage.source}`,
    };
  }

  if (bodyText.trim().length < MIN_CONTENT_CHARS) {
    return {
      result: "expired",
      code: "insufficient_content",
      reason: "insufficient content — likely nav/footer only",
    };
  }

  return {
    result: "uncertain",
    code: "no_apply_control",
    reason: "content present but no visible apply control found",
  };
}

export interface CheckLivenessOpts {
  /** Injectable for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fetch a posting and classify its liveness. Tolerates non-2xx (a 404/410 IS the
 * signal). A network error / timeout is `uncertain` (kept), never `expired`.
 */
export async function checkLiveness(
  url: string,
  opts: CheckLivenessOpts = {},
): Promise<LivenessResult> {
  const { fetchImpl = fetch, timeoutMs = 15_000 } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA },
      redirect: "follow",
    });
    const bodyText = await res.text().catch(() => "");
    return classifyLiveness({ status: res.status, finalUrl: res.url, bodyText });
  } catch (err) {
    return {
      result: "uncertain",
      code: "fetch_error",
      reason: err instanceof Error ? err.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}
