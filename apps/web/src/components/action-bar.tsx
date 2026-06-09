"use client";

import type { JobStatus } from "@homejobboard/shared";
import { Check, ExternalLink, RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setJobStatus } from "@/lib/api";

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
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={applyUrl}
        target="_blank"
        rel="noreferrer"
        onClick={() => status === "new" && update("applied")}
        className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 font-medium text-sm text-white hover:opacity-90"
      >
        <ExternalLink className="h-4 w-4" /> Apply
      </a>
      <button
        type="button"
        disabled={busy || status === "applied"}
        onClick={() => update("applied")}
        className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-sm hover:text-foreground disabled:opacity-50"
      >
        <Check className="h-4 w-4" /> Applied
      </button>
      <button
        type="button"
        disabled={busy || status === "dismissed"}
        onClick={() => update("dismissed")}
        className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-muted text-sm hover:text-foreground disabled:opacity-50"
      >
        <X className="h-4 w-4" /> Dismiss
      </button>
      {status !== "new" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => update("new")}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-muted text-sm hover:text-foreground disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      )}
      <span className="text-muted text-xs">status: {status}</span>
    </div>
  );
}
