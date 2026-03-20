"use client";

import type { DeliveryLineItemInput } from "@/types";

interface DeliveryLogFormProps {
  restaurantId: string;
  deliveryDate: string;
  initialItems?: DeliveryLineItemInput[];
  onSave: (items: DeliveryLineItemInput[], notes?: string) => Promise<void>;
}

/**
 * DeliveryLogForm — admin form for logging delivery line items.
 *
 * Pre-populates from fulfilled order if available.
 * Line items: item name (searchable), qty, unit, unit_price (auto-fills from price_catalog), line_total.
 * Running total at bottom.
 * "Save Delivery" button.
 *
 * Auto-calculates: line_total = qty × unit_price (client-side preview; DB trigger is authoritative).
 *
 * TODO: Build full UI in Phase 1
 */
export function DeliveryLogForm({
  restaurantId,
  deliveryDate,
  initialItems,
  onSave,
}: DeliveryLogFormProps) {
  void restaurantId;
  void deliveryDate;
  void initialItems;
  void onSave;

  return (
    <div className="p-4">
      <p className="text-center text-gray-400 text-sm">
        DeliveryLogForm — TODO: implement in Phase 1
      </p>
    </div>
  );
}
