"use client";

import { ACTIVE_STATUSES, type FollowUpInfo, type JobStatus } from "@homejobboard/shared";
import { Check, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiClientError, draftFollowUp, logFollowUp } from "@/lib/api";
import { urgencyMeta } from "@/lib/format";

/** Follow-up cadence + draft/log for a tracked application. Shown only for engaged
 *  statuses (applied → offer). Drafts are editable; "mark sent" logs the follow-up. */
export function FollowUpPanel({
  jobId,
  status,
  followUp,
  followUpCount,
}: {
  jobId: string;
  status: JobStatus;
  followUp: FollowUpInfo | null;
  followUpCount: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"draft" | "log" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!(ACTIVE_STATUSES as readonly string[]).includes(status)) return null;

  async function generate() {
    setBusy("draft");
    setError(null);
    try {
      const r = await draftFollowUp(jobId);
      setDraft(r.content);
    } catch (e) {
      setError(
        e instanceof ApiClientError ? e.body.error : e instanceof Error ? e.message : "failed",
      );
    } finally {
      setBusy(null);
    }
  }

  async function markSent() {
    setBusy("log");
    try {
      await logFollowUp(jobId);
      setDraft("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const urg = followUp ? urgencyMeta(followUp.urgency) : null;
  const due = followUp?.nextFollowUpAt?.slice(0, 10);

  return (
    <div className="rounded border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] text-muted uppercase tracking-widest">follow-up</p>
        {urg && (
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${urg.color}`}
          >
            {urg.label}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-[13px] text-muted">
        {due ? `next: ${due}` : "no follow-up scheduled"}
        {followUpCount > 0 && ` · ${followUpCount} sent`}
      </p>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={generate}
          className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Mail className="h-3.5 w-3.5" /> {busy === "draft" ? "…" : "Draft follow-up"}
        </button>
      </div>
      {error && <p className="mt-2 font-mono text-primary text-xs">{error}</p>}

      {draft && (
        <div className="mt-3 space-y-2 border-border border-t pt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={9}
            className="w-full rounded border border-border bg-background p-2 font-mono text-[12px] leading-relaxed focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={markSent}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> Mark sent
          </button>
        </div>
      )}
    </div>
  );
}
