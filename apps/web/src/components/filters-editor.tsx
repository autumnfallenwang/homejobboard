"use client";

import type { JobFilters } from "@homejobboard/shared";
import { useState } from "react";
import { setSetting } from "@/lib/api";

const splitCsv = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

/**
 * Friendly editor over the `job_filters` setting (JSON `JobFilters`). Applied by
 * every poll before a job is stored or scored — the cheap pre-LLM gate.
 */
export function FiltersEditor({ initial }: { initial: JobFilters }) {
  const [keywords, setKeywords] = useState(initial.keywords.join(", "));
  const [excludes, setExcludes] = useState(initial.excludeKeywords.join(", "));
  const [location, setLocation] = useState(initial.location ?? "");
  const [workplace, setWorkplace] = useState(initial.workplaceType ?? "");
  const [postedSince, setPostedSince] = useState(initial.postedSince ?? "");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");

  async function save() {
    setState("saving");
    const filters: JobFilters = {
      keywords: splitCsv(keywords),
      excludeKeywords: splitCsv(excludes),
      ...(location.trim() && { location: location.trim() }),
      ...(workplace && { workplaceType: workplace as JobFilters["workplaceType"] }),
      ...(postedSince && { postedSince }),
    };
    try {
      await setSetting("job_filters", JSON.stringify(filters));
      setState("done");
    } catch {
      setState("idle");
    }
  }

  const field =
    "w-full rounded border border-border bg-card px-2 py-1.5 text-sm focus:border-primary focus:outline-none";
  const label = "mb-1 block font-mono text-[11px] text-muted uppercase tracking-wider";

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="f-keywords">
            keywords — any must match
          </label>
          <input
            id="f-keywords"
            value={keywords}
            onChange={(e) => {
              setKeywords(e.target.value);
              setState("idle");
            }}
            placeholder="typescript, backend, platform"
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor="f-excludes">
            excludes — dealbreakers
          </label>
          <input
            id="f-excludes"
            value={excludes}
            onChange={(e) => {
              setExcludes(e.target.value);
              setState("idle");
            }}
            placeholder="crypto, staffing agency"
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor="f-location">
            location contains
          </label>
          <input
            id="f-location"
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setState("idle");
            }}
            placeholder="United States (remote always passes)"
            className={field}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="f-workplace">
              workplace
            </label>
            <select
              id="f-workplace"
              value={workplace}
              onChange={(e) => {
                setWorkplace(e.target.value);
                setState("idle");
              }}
              className={field}
            >
              <option value="">any</option>
              <option value="remote">remote</option>
              <option value="hybrid">hybrid</option>
              <option value="onsite">onsite</option>
            </select>
          </div>
          <div>
            <label className={label} htmlFor="f-posted">
              posted within
            </label>
            <select
              id="f-posted"
              value={postedSince}
              onChange={(e) => {
                setPostedSince(e.target.value);
                setState("idle");
              }}
              className={field}
            >
              <option value="">any time</option>
              <option value="24h">24 hours</option>
              <option value="3d">3 days</option>
              <option value="7d">7 days</option>
              <option value="14d">14 days</option>
            </select>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="rounded bg-primary px-3 py-1.5 font-medium text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {state === "saving" ? "Saving…" : "Save filters"}
        </button>
        {state === "done" && <span className="font-mono text-muted text-xs">saved ✓</span>}
        <span className="font-mono text-[11px] text-muted">
          applies to the next poll; unknown fields never disqualify a job
        </span>
      </div>
    </div>
  );
}
