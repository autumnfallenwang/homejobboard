import { describe, expect, it } from "vitest";
import { markdownToHtml, materialHtml, normalizeTextForATS } from "./materials.js";

describe("normalizeTextForATS", () => {
  it("converts problematic Unicode to ATS-safe ASCII", () => {
    expect(normalizeTextForATS("a—b")).toBe("a-b"); // em-dash
    expect(normalizeTextForATS("a–b")).toBe("a-b"); // en-dash
    expect(normalizeTextForATS("“hi” ‘yo’")).toBe("\"hi\" 'yo'"); // smart quotes
    expect(normalizeTextForATS("a b")).toBe("a b"); // nbsp
    expect(normalizeTextForATS("a​b")).toBe("ab"); // zero-width removed
    expect(normalizeTextForATS("x • y")).toBe("x | y"); // bullet glyph
    expect(normalizeTextForATS("€100")).toBe("EUR 100"); // euro
    expect(normalizeTextForATS("Cut p95 → 380ms")).toBe("Cut p95 to 380ms"); // arrow
  });
});

describe("markdownToHtml", () => {
  it("renders headings, bold, bullet lists, and paragraphs", () => {
    const html = markdownToHtml(
      "# Jane\n\n## Experience\n\n- **Lead** built X\n- shipped Y\n\nA para.",
    );
    expect(html).toContain("<h1>Jane</h1>");
    expect(html).toContain("<h2>Experience</h2>");
    expect(html).toContain("<ul><li><strong>Lead</strong> built X</li><li>shipped Y</li></ul>");
    expect(html).toContain("<p>A para.</p>");
  });

  it("escapes raw HTML in the source (no injection)", () => {
    expect(markdownToHtml("hi <script>alert(1)</script>")).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(markdownToHtml("hi <script>alert(1)</script>")).not.toContain("<script>");
  });
});

describe("materialHtml", () => {
  it("produces a full doc with the CV print CSS and ATS-normalized text", () => {
    const doc = materialHtml("cv", "# Résumé\n\nLed team — shipped “it”.");
    expect(doc.startsWith("<!doctype html>")).toBe(true);
    expect(doc).toContain("<style>");
    expect(doc).toContain("@page"); // print CSS present
    expect(doc).toContain('<body class="cv">');
    expect(doc).toContain("<h1>Résumé</h1>"); // accented letters preserved
    expect(doc).not.toContain("—"); // em-dash normalized away
    expect(doc).not.toContain("“"); // smart quote normalized away
  });

  it("uses the cover-letter CSS for kind=cover", () => {
    const doc = materialHtml("cover", "# Dear team");
    expect(doc).toContain('<body class="cover">');
    expect(doc).toContain("Helvetica"); // cover stack
  });
});
