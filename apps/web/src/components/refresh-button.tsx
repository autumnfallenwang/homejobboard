"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { triggerPoll, triggerScore } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Poll all sources, score the new jobs, then refresh the server-rendered feed. */
export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<"poll" | "score" | null>(null);

  async function refresh() {
    setBusy("poll");
    try {
      await triggerPoll();
      setBusy("score");
      await triggerScore();
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy != null}
      className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 font-mono text-muted text-xs uppercase tracking-wider transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
      {busy === "poll" ? "Polling…" : busy === "score" ? "Scoring…" : "Refresh"}
    </button>
  );
}
