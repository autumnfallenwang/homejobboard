"use client";

import { type MaterialKind, materialHtml } from "@homejobboard/shared";
import { Download, FileText, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ApiClientError, generateMaterial } from "@/lib/api";

/** Prepare-application panel: generate a tailored CV / cover letter, edit it, then
 *  export to PDF via the browser print dialog. Never auto-submits. */
export function MaterialsPanel({ jobId }: { jobId: string }) {
  const [kind, setKind] = useState<MaterialKind | null>(null);
  const [content, setContent] = useState("");
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState<MaterialKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsCv, setNeedsCv] = useState(false);

  async function generate(k: MaterialKind) {
    setBusy(k);
    setError(null);
    setNeedsCv(false);
    try {
      const res = await generateMaterial(jobId, k);
      setKind(k);
      setContent(res.content);
      setModel(res.model);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 400 && /no CV/i.test(e.body.error)) {
        setNeedsCv(true);
      } else {
        setError(e instanceof Error ? e.message : "generation failed");
      }
    } finally {
      setBusy(null);
    }
  }

  function exportPdf() {
    if (!kind || !content.trim()) return;
    const blob = new Blob([materialHtml(kind, content)], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      URL.revokeObjectURL(url);
      return;
    }
    // Print once the print-styled doc has loaded, then release the blob URL.
    win.addEventListener(
      "load",
      () => {
        win.focus();
        win.print();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      { once: true },
    );
  }

  return (
    <div className="rounded border border-border bg-card p-4">
      <p className="mb-2.5 font-mono text-[10px] text-muted uppercase tracking-widest">
        prepare application
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => generate("cv")}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <FileText className="h-3.5 w-3.5" /> {busy === "cv" ? "…" : "Tailor CV"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => generate("cover")}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Mail className="h-3.5 w-3.5" /> {busy === "cover" ? "…" : "Cover letter"}
        </button>
      </div>

      {needsCv && (
        <p className="mt-3 text-[13px] text-muted">
          Add your CV in{" "}
          <Link href="/settings" className="text-primary hover:underline">
            settings
          </Link>{" "}
          first.
        </p>
      )}
      {error && <p className="mt-3 font-mono text-primary text-xs">{error}</p>}

      {content && (
        <div className="mt-3 space-y-2 border-border border-t pt-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            className="w-full rounded border border-border bg-background p-2 font-mono text-[12px] leading-relaxed focus:border-primary focus:outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={exportPdf}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" /> Export PDF
            </button>
            <span className="font-mono text-[10px] text-muted">
              {kind} · {model} · ⌘P → save as PDF
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
