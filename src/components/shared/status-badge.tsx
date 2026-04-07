import type { AvailabilityStatus } from "@/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: AvailabilityStatus;
  limitedQty?: number | null;
  className?: string;
}

const STATUS_CONFIG = {
  available: {
    dot: "bg-farm-green",
    label: "Available",
    text: "text-farm-green",
    bg: "bg-farm-green-light",
  },
  limited: {
    dot: "bg-yellow-400",
    label: "Limited",
    text: "text-yellow-700",
    bg: "bg-yellow-50",
  },
  unavailable: {
    dot: "bg-red-400",
    label: "Unavailable",
    text: "text-red-600",
    bg: "bg-red-50",
  },
} as const;

/**
 * StatusBadge — displays availability status with colored dot.
 * Used in chef order form and admin availability editor.
 */
export function StatusBadge({ status, limitedQty, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", config.dot)} />
      {status === "limited" && limitedQty != null
        ? `Limited (max ${limitedQty})`
        : config.label}
    </span>
  );
}
