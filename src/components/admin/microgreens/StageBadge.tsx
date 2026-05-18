import { cn } from "@/lib/utils";
import type { MicrogreenTrayStatus } from "@/types/database";
import { TRAY_STATUS_LABELS, TRAY_STATUS_COLORS } from "@/lib/microgreens/constants";

export function StageBadge({ status, className }: { status: MicrogreenTrayStatus; className?: string }) {
  return (
    <span className={cn(
      "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
      TRAY_STATUS_COLORS[status],
      className,
    )}>
      {TRAY_STATUS_LABELS[status]}
    </span>
  );
}
