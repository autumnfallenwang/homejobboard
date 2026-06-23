import type { FitnessSubScores, FitnessVerdict } from "@homejobboard/shared";
import { recommendation, subScoreFill } from "@/lib/format";

const DIMENSIONS: Array<[keyof FitnessSubScores, string]> = [
  ["skills", "Skills"],
  ["seniority", "Seniority"],
  ["domain", "Domain"],
  ["compensation", "Comp"],
  ["logistics", "Logistics"],
];

/** Detail-view rubric verdict: recommendation + sub-score bars + strengths/stops/gaps. */
export function VerdictPanel({ verdict }: { verdict: FitnessVerdict }) {
  const rec = recommendation(verdict.recommendation);
  return (
    <div className="mt-3 space-y-3 border-border border-t pt-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded border px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${rec.color}`}
        >
          {rec.label}
        </span>
        <span className="font-mono text-[10px] text-muted uppercase tracking-widest">
          {verdict.confidence} confidence
        </span>
      </div>

      <dl className="space-y-1">
        {DIMENSIONS.map(([key, label]) => (
          <div key={key} className="flex items-center gap-2 text-[12px]">
            <dt className="w-16 shrink-0 font-mono text-muted text-[11px] uppercase tracking-wider">
              {label}
            </dt>
            <dd className="flex flex-1 items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border/50">
                <span
                  className={`block h-full rounded-full ${subScoreFill(verdict.subScores[key])}`}
                  style={{ width: `${(verdict.subScores[key] / 5) * 100}%` }}
                />
              </span>
              <span className="w-6 text-end font-mono text-[11px] tabular-nums">
                {verdict.subScores[key]}/5
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <VerdictList
        title="strengths"
        items={verdict.topStrengths}
        marker="✓"
        markerClass="text-success"
      />
      <VerdictList
        title="hard stops"
        items={verdict.hardStops}
        marker="✕"
        markerClass="text-primary"
      />
      <VerdictList title="gaps" items={verdict.softGaps} marker="△" markerClass="text-warn" />
    </div>
  );
}

function VerdictList({
  title,
  items,
  marker,
  markerClass,
}: {
  title: string;
  items: string[];
  marker: string;
  markerClass: string;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1 font-mono text-[10px] text-muted uppercase tracking-widest">{title}</p>
      <ul className="space-y-1 text-[13px] text-foreground/85 leading-snug">
        {items.map((it) => (
          <li key={it} className="flex gap-2">
            <span className={markerClass}>{marker}</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
