"use client";

import type { OrderItemWithAvailability } from "@/types";

interface ShortageFormProps {
  orderItem: OrderItemWithAvailability;
  onSave: (itemId: string, qtyFulfilled: number, reason: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * ShortageForm — inline form for marking an order item as shorted.
 *
 * Fields: quantity_fulfilled (numeric, ≤ quantity_requested), shortage_reason (text).
 * Pre-fills quantity_fulfilled = quantity_requested for quick editing.
 *
 * TODO: Build full UI in Phase 1
 */
export function ShortageForm({ orderItem, onSave, onCancel }: ShortageFormProps) {
  void orderItem;
  void onSave;
  void onCancel;

  return (
    <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
      <p className="text-center text-gray-400 text-sm">
        ShortageForm — TODO: implement in Phase 1
      </p>
    </div>
  );
}
