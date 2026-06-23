"use client";

import type { SourceConfig, SourceKind } from "@homejobboard/shared";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSource, deleteSource, setSourceEnabled, triggerPoll, triggerScore } from "@/lib/api";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// ATS kinds that take a single lowercase per-company board token and can be added
// from the UI. (SmartRecruiters' identifiers are case-sensitive and Workday needs
// tenant/instance/site, so both are seed/API-added, not offered here.)
const ATS_KINDS = ["greenhouse", "lever", "ashby", "recruitee", "workable"] as const;

/** Source manager: per-board enable toggles grouped by family, add/remove ATS boards,
 *  manual poll/score triggers. */
export function SourceToggles({ sources }: { sources: SourceConfig[] }) {
  const router = useRouter();
  const [items, setItems] = useState(sources);
  const [busy, setBusy] = useState<string | null>(null);
  const [addKind, setAddKind] = useState<(typeof ATS_KINDS)[number]>("greenhouse");
  const [addToken, setAddToken] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  async function toggle(s: SourceConfig) {
    setBusy(s.id);
    try {
      const updated = await setSourceEnabled(s.id, !s.enabled);
      setItems((prev) => prev.map((it) => (it.id === s.id ? updated : it)));
    } finally {
      setBusy(null);
    }
  }

  async function remove(s: SourceConfig) {
    if (!window.confirm(`Remove source "${s.slug}"? Its already-ingested jobs stay.`)) return;
    setBusy(s.id);
    try {
      await deleteSource(s.id);
      setItems((prev) => prev.filter((it) => it.id !== s.id));
    } finally {
      setBusy(null);
    }
  }

  async function add() {
    const token = addToken.trim().toLowerCase();
    if (!token) return;
    setBusy("add");
    setAddError(null);
    try {
      const created = await createSource({
        slug: `${addKind}:${token}`,
        kind: addKind as SourceKind,
        params: { companyToken: token },
      });
      setItems((prev) => [...prev, created].sort((a, b) => a.slug.localeCompare(b.slug)));
      setAddToken("");
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "failed");
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

  const families = [...new Set(items.map((s) => s.slug.split(":")[0] ?? s.slug))].sort();

  return (
    <div className="space-y-4">
      {families.map((family) => (
        <div key={family}>
          <p className="mb-1 font-mono text-[11px] text-muted uppercase tracking-widest">
            {family}
          </p>
          <ul className="divide-y divide-border rounded border border-border bg-card">
            {items
              .filter((s) => (s.slug.split(":")[0] ?? s.slug) === family)
              .map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-sm">{s.slug}</span>
                  <span className="hidden font-mono text-[11px] text-muted sm:inline">
                    {s.lastPolledAt
                      ? `polled ${formatRelativeTime(s.lastPolledAt)}`
                      : "never polled"}
                  </span>
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => toggle(s)}
                    className={cn(
                      "w-20 rounded border px-2 py-0.5 font-mono text-xs transition-colors disabled:opacity-50",
                      s.enabled
                        ? "border-success/50 text-success"
                        : "border-border text-muted hover:text-foreground",
                    )}
                  >
                    {s.enabled ? "enabled" : "off"}
                  </button>
                  <button
                    type="button"
                    disabled={busy === s.id}
                    onClick={() => remove(s)}
                    title={`Remove ${s.slug}`}
                    className="text-muted transition-colors hover:text-primary disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}

      {/* Add an ATS company board: kind + company token (the bit after the ATS domain). */}
      <div className="rounded border border-border border-dashed p-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={addKind}
            onChange={(e) => setAddKind(e.target.value as (typeof ATS_KINDS)[number])}
            className="rounded border border-border bg-card px-2 py-1 font-mono text-xs"
          >
            {ATS_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input
            value={addToken}
            onChange={(e) => setAddToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="company token, e.g. figma"
            className="w-48 rounded border border-border bg-card px-2 py-1 text-sm placeholder:text-muted/70 focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            disabled={busy === "add" || !addToken.trim()}
            onClick={add}
            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 font-mono text-xs uppercase tracking-wider transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> add board
          </button>
          {addError && <span className="font-mono text-primary text-xs">{addError}</span>}
        </div>
        <p className="mt-2 font-mono text-[11px] text-muted">
          the token is the slug in the board url — greenhouse.io/<b>figma</b>, jobs.lever.co/
          <b>zoox</b>, jobs.ashbyhq.com/<b>linear</b>, <b>acme</b>.recruitee.com,
          apply.workable.com/<b>acme</b>
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy === "poll"}
          onClick={() => run(() => triggerPoll(), "poll")}
          className="rounded border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {busy === "poll" ? "Polling…" : "Poll now"}
        </button>
        <button
          type="button"
          disabled={busy === "score"}
          onClick={() => run(() => triggerScore(), "score")}
          className="rounded border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {busy === "score" ? "Scoring…" : "Score now"}
        </button>
      </div>
    </div>
  );
}
