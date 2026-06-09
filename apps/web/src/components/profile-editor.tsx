"use client";

import { useState } from "react";
import { setSetting } from "@/lib/api";

/** Edit the fitness_profile setting the LLM scores jobs against. */
export function ProfileEditor({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState<"idle" | "saving" | "done">("idle");

  async function save() {
    setSaved("saving");
    try {
      await setSetting("fitness_profile", value);
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
        rows={5}
        className="w-full rounded border border-border bg-card p-2 text-sm"
        placeholder="Describe your ideal job: role, stack, level, location/remote, comp, dealbreakers."
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saved === "saving"}
          className="rounded bg-primary px-3 py-1.5 font-medium text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {saved === "saving" ? "Saving…" : "Save profile"}
        </button>
        {saved === "done" && <span className="text-muted text-sm">Saved ✓</span>}
      </div>
      <p className="text-muted text-xs">
        New scores use this profile. Re-score from the feed's Refresh, or the buttons below.
      </p>
    </div>
  );
}
