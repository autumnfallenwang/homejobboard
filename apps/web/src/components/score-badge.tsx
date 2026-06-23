import { scoreColor, scoreFill } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Fitness score (0–100): tabular mono number over a thin meter, colored by band.
 * Renders a dash when unscored. `size="lg"` is the detail-page hero variant.
 */
export function ScoreBadge({
  fitness,
  size = "sm",
}: {
  fitness: number | null | undefined;
  size?: "sm" | "lg";
}) {
  if (fitness == null) {
    return (
      <span
        className={cn(
          "font-mono text-muted tabular-nums",
          size === "lg" ? "text-3xl" : "text-base",
        )}
        title="not scored yet"
      >
        —
      </span>
    );
  }
  return (
    <span className={cn("inline-flex flex-col", size === "lg" ? "gap-1.5" : "gap-1")}>
      <span
        className={cn(
          "font-medium font-mono leading-none tabular-nums",
          size === "lg" ? "text-4xl" : "text-base",
          scoreColor(fitness),
        )}
      >
        {fitness}
      </span>
      <span
        className={cn(
          "block overflow-hidden rounded-full bg-border",
          size === "lg" ? "h-1.5 w-16" : "h-0.5 w-8",
        )}
      >
        <span
          className={cn("sweep block h-full", scoreFill(fitness))}
          style={{ width: `${fitness}%` }}
        />
      </span>
    </span>
  );
}
