// Presentation helpers — pure, unit-tested.

/** "just now" / "3h ago" / "2d ago" from an ISO string (or "" when absent). */
export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const diffMs = now.getTime() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Tailwind text color for a 0–100 fitness score (theme tokens, light+dark safe). */
export function scoreColor(fitness: number): string {
  if (fitness >= 80) return "text-success";
  if (fitness >= 60) return "text-foreground";
  if (fitness >= 40) return "text-warn";
  return "text-muted";
}

/** Matching background token for the score meter fill. */
export function scoreFill(fitness: number): string {
  if (fitness >= 80) return "bg-success";
  if (fitness >= 60) return "bg-foreground";
  if (fitness >= 40) return "bg-warn";
  return "bg-muted";
}

/** "$120k", "$85" (sub-1k values untouched). */
function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

/** "$120k–$170k" / "$120k+" / "up to $170k" / "" when unknown. */
export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (min != null && max != null) {
    return min === max ? money(min) : `${money(min)}–${money(max)}`;
  }
  if (min != null) return `${money(min)}+`;
  if (max != null) return `up to ${money(max)}`;
  return "";
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decode entities + strip tags to readable plain text, preserving paragraph/line
 * breaks. Used instead of dangerouslySetInnerHTML so third-party job HTML can't XSS.
 */
export function plainText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name.toLowerCase()] ?? m)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export type DescriptionBlock = { type: "h" | "p" | "li"; text: string };

/**
 * Structure `plainText` output for rendering: bullets become list items, short
 * unpunctuated lines read as run-in headings, the rest are paragraphs.
 */
export function descriptionBlocks(html: string | null | undefined): DescriptionBlock[] {
  const text = plainText(html);
  if (!text) return [];
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): DescriptionBlock => {
      if (line.startsWith("• ")) return { type: "li", text: line.slice(2).trim() };
      if (line.length <= 60 && !/[.!?:;,]$/.test(line) && /^[A-Z]/.test(line)) {
        return { type: "h", text: line };
      }
      return { type: "p", text: line };
    });
}
