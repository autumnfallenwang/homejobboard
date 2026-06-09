"use client";

import type { SourceConfig } from "@homejobboard/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setSourceEnabled, triggerPoll, triggerScore } from "@/lib/api";

/** Enable/disable sources + manual poll/score triggers. */
export function SourceToggles({ sources }: { sources: SourceConfig[] }) {
  const router = useRouter();
  const [items, setItems] = useState(sources);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(s: SourceConfig) {
    setBusy(s.id);
    try {
      const updated = await setSourceEnabled(s.id, !s.enabled);
      setItems((prev) => prev.map((it) => (it.id === s.id ? updated : it)));
    } finally {
      setBusy(null);
    }
  }

  async function run(fn: () => Promise<unknown>, label: string) {
    setBusy(label);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y divide-border rounded border border-border">
        {items.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-3 py-2">
            <span className="font-mono text-sm">{s.slug}</span>
            <button
              type="button"
              disabled={busy === s.id}
              onClick={() => toggle(s)}
              className="rounded border border-border px-2 py-0.5 text-sm hover:text-foreground disabled:opacity-50"
            >
              {s.enabled ? "Enabled" : "Disabled"}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy === "poll"}
          onClick={() => run(() => triggerPoll(), "poll")}
          className="rounded border border-border px-3 py-1.5 text-sm hover:text-foreground disabled:opacity-50"
        >
          {busy === "poll" ? "Polling…" : "Poll now"}
        </button>
        <button
          type="button"
          disabled={busy === "score"}
          onClick={() => run(() => triggerScore(), "score")}
          className="rounded border border-border px-3 py-1.5 text-sm hover:text-foreground disabled:opacity-50"
        >
          {busy === "score" ? "Scoring…" : "Score now"}
        </button>
      </div>
    </div>
  );
}
