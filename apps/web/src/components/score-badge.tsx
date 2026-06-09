import { scoreColor } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Fitness score chip (0–100), colored by band. Renders a dash when unscored. */
export function ScoreBadge({ fitness }: { fitness: number | null | undefined }) {
  if (fitness == null) {
    return <span className="font-mono text-muted text-sm tabular-nums">—</span>;
  }
  return (
    <span className={cn("font-mono font-medium text-base tabular-nums", scoreColor(fitness))}>
      {fitness}
    </span>
  );
}
