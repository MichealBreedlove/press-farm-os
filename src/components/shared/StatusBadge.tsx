import { cn } from "@/lib/utils";

/**
 * Availability status as a Badge with a leading dot — the one consistent
 * treatment for in-stock / low / out. Reuses the existing badge-* color
 * families (green / amber / gray) so status reads stay disciplined and never
 * compete with the lane accents. Status colors are reserved for availability.
 */
export type AvailabilityStatus = "available" | "limited" | "unavailable";

const MAP: Record<AvailabilityStatus, { label: string; badge: string; dot: string }> = {
  available: { label: "In stock", badge: "badge-green", dot: "bg-farm-green" },
  limited: { label: "Low", badge: "badge-gold", dot: "bg-amber-500" },
  unavailable: { label: "Out", badge: "badge-gray", dot: "bg-gray-400" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: AvailabilityStatus;
  /** Override the default word (e.g. "Limited" instead of "Low"). */
  label?: string;
  className?: string;
}) {
  const s = MAP[status];
  return (
    <span className={cn(s.badge, "gap-1.5", className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", s.dot)} aria-hidden="true" />
      {label ?? s.label}
    </span>
  );
}
