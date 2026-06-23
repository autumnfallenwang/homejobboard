"use client";

import { type JobStatus, STATUS_TRANSITIONS } from "@homejobboard/shared";
import { ExternalLink, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setJobStatus } from "@/lib/api";
import { statusMeta } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Apply link + application-lifecycle controls: advance to the legal next statuses,
 *  discard, or reset to the inbox. The state machine lives in @homejobboard/shared. */
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

  const forward = STATUS_TRANSITIONS[status]; // legal next pipeline statuses
  const meta = statusMeta(status);

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

      {forward.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {forward.map((next) => (
            <button
              key={next}
              type="button"
              disabled={busy}
              onClick={() => update(next)}
              className={cn(
                "flex-1 rounded border px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50",
                next === "rejected"
                  ? "border-border text-muted hover:border-primary/50 hover:text-primary"
                  : "border-border hover:border-success/60 hover:text-success",
              )}
            >
              → {statusMeta(next).label}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {status !== "discarded" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => update("discarded")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded border border-border px-3 py-1.5 text-muted text-sm transition-colors hover:border-primary/60 hover:text-primary disabled:opacity-50"
          >
            <X className="h-4 w-4" /> Discard
          </button>
        )}
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
        status: <span className={cn(status !== "new" && meta.color)}>{meta.label}</span>
      </p>
    </div>
  );
}
