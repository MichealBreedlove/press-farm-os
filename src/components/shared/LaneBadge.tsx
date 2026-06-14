import { laneStyle } from "@/lib/lanes";
import { cn } from "@/lib/utils";

/**
 * Labeled lane badge — a leading colored dot + the restaurant name, using the
 * shared lane identity (src/lib/lanes.ts). Same lane = same dot color app-wide.
 * The label carries each restaurant's typographic echo (Press tracked caps /
 * Under-Study italic serif). Pair with a `border-l-2 <lane.border>` accent on
 * the surrounding card/row.
 */
export function LaneBadge({ name, className }: { name: string; className?: string }) {
  const lane = laneStyle(name);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-white border border-farm-dark/10 px-2.5 py-0.5 text-farm-dark",
        className,
      )}
    >
      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", lane.dot)} aria-hidden="true" />
      <span className={lane.labelClass}>{lane.label}</span>
    </span>
  );
}
