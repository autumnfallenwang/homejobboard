"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { triggerPoll, triggerScore } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Poll all sources, score the new jobs, then refresh the server-rendered feed. */
export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      await triggerPoll();
      await triggerScore();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-muted text-sm hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} />
      {busy ? "Refreshing…" : "Refresh"}
    </button>
  );
}
