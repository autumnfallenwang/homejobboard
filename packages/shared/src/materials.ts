// Application materials (M09): the API↔web contract for generated CV / cover-letter
// content, plus the pure render path (markdown → ATS-clean, print-styled HTML) the web
// uses for browser print-to-PDF. `normalizeTextForATS` is ported from career-ops (MIT)
// `generate-pdf.mjs`; the print CSS is adapted from its cv/cover-letter templates.
// See docs/adr/0005-browser-print-over-playwright.md.

import { z } from "zod";

export const materialKindSchema = z.enum(["cv", "cover"]);
export type MaterialKind = z.infer<typeof materialKindSchema>;

export const materialResultSchema = z.object({
  kind: materialKindSchema,
  content: z.string(), // tailored markdown
  model: z.string(),
});
export type MaterialResult = z.infer<typeof materialResultSchema>;

/**
 * Convert text to ATS-safe ASCII (ported from career-ops `normalizeTextForATS`).
 * ATS parsers and PDF text extractors choke on smart quotes, em-dashes, zero-width
 * chars, NBSP, arrows, and bullet glyphs. Applied to the markdown *before* render,
 * so the generated HTML tags + CSS stay untouched. Uses \u escapes (no literal
 * invisible chars in source).
 */
export function normalizeTextForATS(text: string): string {
  return text
    .replace(/—/g, "-") // em-dash
    .replace(/–/g, "-") // en-dash
    .replace(/[“”„‟]/g, '"') // smart double quotes
    .replace(/[‘’‚‛]/g, "'") // smart single quotes
    .replace(/…/g, "...") // ellipsis
    .replace(/​|‌|‍|⁠|﻿/g, "") // zero-width chars
    .replace(/ /g, " ") // non-breaking space
    .replace(/\s*→\s*/g, " to ") // right arrow
    .replace(/\s*←\s*/g, " from ") // left arrow
    .replace(/\s*[↑↓]\s*/g, " ") // vertical arrows
    .replace(/\s*·\s*/g, " | ") // middle dot
    .replace(/\s*•\s*/g, " | ") // bullet (stray, in prose)
    .replace(/€/g, "EUR ") // euro
    .replace(/£/g, "GBP "); // pound
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Inline markdown → HTML (escaped first): `**bold**`, `*italic*`, `[text](url)`. */
function inline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Minimal markdown → HTML for the clean markdown the materials prompts emit:
 * `#/##/###` headings, `-`/`*` bullet lists, blank-line paragraphs, plus the inline
 * marks above. Raw HTML in the source is escaped (never injected).
 */
export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = (): void => {
    if (para.length) {
      out.push(`<p>${inline(para.join(" "))}</p>`);
      para = [];
    }
  };
  const flushList = (): void => {
    if (list.length) {
      out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const item = line.match(/^[-*]\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      const n = heading[1]?.length ?? 1;
      out.push(`<h${n}>${inline(heading[2] ?? "")}</h${n}>`);
    } else if (item) {
      flushPara();
      list.push(item[1] ?? "");
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out.join("\n");
}

// ATS-safe static system-sans stack (no variable webfonts — they inject spurious
// spaces into PDF text extraction). Ported aesthetic from career-ops templates.
const SANS = "'Liberation Sans', 'Helvetica Neue', Arial, 'DejaVu Sans', sans-serif";

const CV_PRINT_CSS = `
  @page { margin: 0.6in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${SANS}; font-size: 11px; line-height: 1.5; color: #1a1a2e; background: #fff; max-width: 8.5in; margin: 0 auto; padding: 2px; }
  h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; margin-bottom: 6px; }
  h2 { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: hsl(187,74%,32%); border-bottom: 1.5px solid #e2e2e2; padding-bottom: 4px; margin: 16px 0 8px; }
  h3 { font-size: 12.5px; font-weight: 600; color: hsl(270,70%,45%); margin-top: 10px; }
  p { font-size: 11px; line-height: 1.6; color: #2f2f2f; margin: 5px 0; }
  ul { padding-left: 18px; margin: 6px 0; }
  li { font-size: 10.5px; line-height: 1.6; color: #333; margin-bottom: 4px; break-inside: avoid; }
  strong { font-weight: 600; }
  a { color: #555; text-decoration: none; white-space: nowrap; }
`;

const COVER_PRINT_CSS = `
  @page { margin: 0.8in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.4; color: #1a1a1a; background: #fff; max-width: 7in; margin: 0 auto; }
  h1 { font-size: 14pt; font-weight: 700; margin-bottom: 3pt; }
  h2 { font-size: 11pt; font-weight: 700; margin: 10pt 0 2pt; }
  h3 { font-size: 10pt; font-weight: 700; margin: 8pt 0 2pt; }
  p { margin-bottom: 8pt; }
  ul { list-style: none; margin-bottom: 4pt; }
  li { margin-bottom: 5pt; padding-left: 14pt; position: relative; }
  li::before { content: "-"; position: absolute; left: 0; }
  a { color: #1a56a0; text-decoration: none; }
`;

/**
 * Render generated material markdown into a standalone, print-styled HTML document
 * (ATS-normalized text + the kind's inlined print CSS). The web opens this in a print
 * window for browser "Save as PDF" — no server browser. Pure + testable.
 */
export function materialHtml(kind: MaterialKind, markdown: string): string {
  const body = markdownToHtml(normalizeTextForATS(markdown));
  const css = kind === "cv" ? CV_PRINT_CSS : COVER_PRINT_CSS;
  const title = kind === "cv" ? "CV" : "Cover Letter";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body class="${kind}">${body}</body></html>`;
}
