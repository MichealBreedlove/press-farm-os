import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/types";

const STATUS_CLASSES: Record<OrderStatus, string> = {
  draft: "badge-gray",
  submitted: "badge-blue",
  in_progress: "badge-gold",
  fulfilled: "badge-green",
  cancelled: "badge-red",
};

/**
 * Single source of truth for order status display.
 * Used on chef history, admin orders list, and admin order detail.
 */
export function StatusPill({ status, className = "" }: { status: OrderStatus; className?: string }) {
  const cls = STATUS_CLASSES[status] ?? "badge-gray";
  return (
    <span className={`${cls} flex-shrink-0 ${className}`.trim()}>
      {ORDER_STATUS_LABELS[status] ?? status}
    </span>
  );
}
