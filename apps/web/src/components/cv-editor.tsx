"use client";

import { useState } from "react";
import { setSetting } from "@/lib/api";

/** Edit the canonical `cv` setting (markdown) that per-job materials are tailored from. */
export function CvEditor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState<"idle" | "saving" | "done">("idle");

  async function save() {
    setSaved("saving");
    try {
      await setSetting("cv", value);
      setSaved("done");
    } catch {
      setSaved("idle");
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved("idle");
        }}
        rows={12}
        className="w-full rounded border border-border bg-card p-3 font-mono text-[13px] leading-relaxed focus:border-primary focus:outline-none"
        placeholder={
          "# Your Name\n\n## Summary\n...\n\n## Experience\n### Company — Role (2022–now)\n- Built X, cut p95 latency 40%\n\n## Skills\n..."
        }
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saved === "saving"}
          className="rounded bg-primary px-3 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saved === "saving" ? "Saving…" : "Save CV"}
        </button>
        {saved === "done" && <span className="font-mono text-muted text-xs">saved ✓</span>}
        <span className="font-mono text-[11px] text-muted">
          markdown — the source of truth for tailored CVs + cover letters
        </span>
      </div>
    </div>
  );
}
