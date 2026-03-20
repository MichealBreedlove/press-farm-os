import type { OrderWithDetails } from "@/types";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDeliveryDate } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface OrderCardProps {
  order: OrderWithDetails;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-50 text-blue-700",
  in_progress: "bg-yellow-50 text-yellow-700",
  fulfilled: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

/**
 * OrderCard — admin orders dashboard card for a single restaurant order.
 *
 * Shows: restaurant name, chef, submitted time, item count, status.
 * Taps to order detail.
 *
 * TODO: Add shortage count badge, quick actions
 */
export function OrderCard({ order }: OrderCardProps) {
  const itemCount = order.order_items.length;
  const shortedCount = order.order_items.filter((i) => i.is_shorted).length;

  return (
    <Link
      href={`/admin/orders/${order.delivery_date}`}
      className="block bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{order.restaurant.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {order.chef.full_name ?? "Chef"} ·{" "}
            {order.submitted_at
              ? new Date(order.submitted_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "Not submitted"}
          </p>
        </div>
        <span
          className={cn(
            "text-xs px-2 py-1 rounded-full font-medium flex-shrink-0",
            STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
          )}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="flex gap-4 mt-3 text-sm text-gray-500">
        <span>{itemCount} items</span>
        {shortedCount > 0 && (
          <span className="text-orange-600">{shortedCount} shorted</span>
        )}
        {order.freeform_notes && (
          <span className="text-blue-600">Has notes</span>
        )}
      </div>
    </Link>
  );
}
