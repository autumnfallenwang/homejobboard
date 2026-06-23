// Fuzzy role-title matching for dedup. Pure logic ported from career-ops (MIT)
// `role-matcher.mjs`: decide whether two same-company titles describe the same
// opening, so "Senior Data Platform Engineer" and "Data Platform Engineer" collapse
// while sibling roles ("Full Stack Engineer, Foundation" vs "…, Guarded Releases")
// stay distinct. Used by dedup.ts on top of the exact company+title+location key.

// Tokens almost every role shares — they must not count as strong matching signal
// (seniority, work mode, contract shape, common locations, generic job words).
export const ROLE_STOPWORDS = new Set([
  "junior",
  "mid",
  "middle",
  "senior",
  "staff",
  "principal",
  "lead",
  "head",
  "chief",
  "associate",
  "intern",
  "entry",
  "level",
  "remote",
  "hybrid",
  "onsite",
  "contract",
  "contractor",
  "freelance",
  "fulltime",
  "parttime",
  "permanent",
  "temporary",
  "internship",
  "role",
  "position",
  "opportunity",
  "team",
  "based",
  "bangalore",
  "bengaluru",
  "mumbai",
  "delhi",
  "hyderabad",
  "pune",
  "chennai",
  "london",
  "berlin",
  "paris",
  "madrid",
  "barcelona",
  "amsterdam",
  "dublin",
  "york",
  "francisco",
  "seattle",
  "boston",
  "austin",
  "chicago",
  "toronto",
  "tokyo",
  "singapore",
  "sydney",
  "melbourne",
  "lisbon",
  "warsaw",
  "europe",
  "emea",
  "apac",
  "latam",
  "americas",
  "india",
  "spain",
  "germany",
  "france",
  "italy",
  "canada",
  "brazil",
  "mexico",
  "japan",
  "with",
  "from",
  "into",
  "over",
  "this",
  "that",
]);

// Short specialty acronyms that are discriminating despite their length. Broad
// two-letter buckets (AI/ML) are intentionally excluded — they span unrelated roles.
export const SHORT_SPECIALTY = new Set([
  "api",
  "sre",
  "sdk",
  "cli",
  "gpu",
  "cpu",
  "ios",
  "qa",
  "ux",
  "ui",
  "ar",
  "vr",
  "ocr",
  "crm",
  "erp",
]);

// Generic role-level descriptors. Two titles whose only overlap is in this set are
// not the same opening — they are merely written at the same altitude.
export const BASELINE_TOKENS = new Set([
  "software",
  "engineer",
  "developer",
  "manager",
  "architect",
  "analyst",
  "designer",
  "consultant",
  "specialist",
  "platform",
  "systems",
  "services",
  "backend",
  "frontend",
  "full",
  "stack",
  "fullstack",
]);

/** Convert a role title into content tokens (long words + a few specialty acronyms, stopwords dropped). */
export function roleTokens(role: string): string[] {
  const text = typeof role === "string" ? role : String(role ?? "");
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => (w.length > 3 || SHORT_SPECIALTY.has(w)) && !ROLE_STOPWORDS.has(w));
}

/**
 * Decide whether two role titles are likely the same opening. Requires ≥2 shared
 * tokens, ≥1 shared token that is not merely baseline vocabulary, and a Jaccard
 * overlap ≥ 0.6.
 */
export function roleFuzzyMatch(a: string, b: string): boolean {
  const wordsA = [...new Set(roleTokens(a))];
  const wordsB = [...new Set(roleTokens(b))];
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const setB = new Set(wordsB);
  const overlap = wordsA.filter((w) => setB.has(w));
  if (overlap.length < 2) return false;

  // Require at least one non-baseline token in the overlap. Roles sharing only
  // generic descriptors like [software, engineer] are not the same opening.
  const discriminating = overlap.filter((w) => !BASELINE_TOKENS.has(w));
  if (discriminating.length === 0) return false;

  // True set-based Jaccard ratio (dividing by the smaller title inflates matches
  // for roles sharing a long generic prefix but differing in specialty).
  const union = new Set([...wordsA, ...wordsB]).size;
  return overlap.length / union >= 0.6;
}
