"use client";

import type { JobStatus } from "@homejobboard/shared";
import { Check, ExternalLink, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setJobStatus } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Send-out + triage for a job: open apply link (and mark applied), dismiss, or reset. */
export function ActionBar({
  jobId,
  applyUrl,
  initialStatus,
}: {
  jobId: string;
  applyUrl: string;
  initialStatus: JobStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [busy, setBusy] = useState(false);

  async function update(next: JobStatus) {
    setBusy(true);
    try {
      await setJobStatus(jobId, next);
      setStatus(next);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <a
        href={applyUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => status === "new" && update("applied")}
        className="flex items-center justify-center gap-2 rounded bg-primary px-3 py-2 font-medium text-background text-sm shadow-sm transition-opacity hover:opacity-90"
      >
        <ExternalLink className="h-4 w-4" /> Apply now
      </a>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || status === "applied"}
          onClick={() => update("applied")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
            status === "applied"
              ? "border-success/50 text-success"
              : "border-border hover:border-success/60 hover:text-success",
          )}
        >
          <Check className="h-4 w-4" /> Applied
        </button>
        <button
          type="button"
          disabled={busy || status === "dismissed"}
          onClick={() => update("dismissed")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded border border-border px-3 py-1.5 text-muted text-sm transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-50"
        >
          <X className="h-4 w-4" /> Dismiss
        </button>
        {status !== "new" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => update("new")}
            title="Back to inbox"
            className="flex items-center justify-center rounded border border-border px-2.5 text-muted transition-colors hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <p className="font-mono text-[11px] text-muted uppercase tracking-widest">
        status: <span className={cn(status !== "new" && "text-foreground")}>{status}</span>
      </p>
    </div>
  );
}
