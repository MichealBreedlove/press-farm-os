"use client";

import type { AvailabilityItemWithItem } from "@/types";
import { StatusBadge } from "@/components/shared/status-badge";
import { UNIT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ItemRowProps {
  availabilityItem: AvailabilityItemWithItem;
  quantity: number;
  onQuantityChange: (id: string, qty: number) => void;
}

/**
 * ItemRow — single item in the chef order form.
 *
 * Shows: status dot, item name, unit badge, chef_notes, cycle_notes, qty input with +/- steppers.
 * Unavailable items are dimmed with disabled input.
 * Limited items clamp input to limited_qty.
 *
 * TODO: Build full UI in Phase 1
 */
export function ItemRow({ availabilityItem, quantity, onQuantityChange }: ItemRowProps) {
  const { item, status, limited_qty, cycle_notes } = availabilityItem;
  const isUnavailable = status === "unavailable";
  const maxQty = status === "limited" ? (limited_qty ?? Infinity) : Infinity;

  function handleChange(value: number) {
    const clamped = Math.max(0, Math.min(value, maxQty));
    onQuantityChange(availabilityItem.id, clamped);
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 py-3 border-b border-gray-100 last:border-0",
        isUnavailable && "opacity-50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900 truncate">{item.name}</span>
          <span className="text-xs text-gray-400 flex-shrink-0">
            {UNIT_LABELS[item.unit_type]}
          </span>
        </div>
        {(cycle_notes ?? item.chef_notes) && (
          <p className="text-xs text-gray-400 italic mt-0.5 truncate">
            {cycle_notes ?? item.chef_notes}
          </p>
        )}
        {status !== "available" && (
          <StatusBadge status={status} limitedQty={limited_qty} className="mt-1" />
        )}
      </div>

      {/* Quantity input with steppers */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => handleChange(quantity - 1)}
          disabled={isUnavailable || quantity <= 0}
          className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-lg disabled:opacity-30"
          aria-label="Decrease quantity"
        >
          −
        </button>
        <input
          type="number"
          min="0"
          max={maxQty === Infinity ? undefined : maxQty}
          step="0.5"
          value={quantity || ""}
          onChange={(e) => handleChange(parseFloat(e.target.value) || 0)}
          disabled={isUnavailable}
          className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1.5 disabled:bg-gray-50 disabled:text-gray-300"
          placeholder="0"
          aria-label={`Quantity for ${item.name}`}
        />
        <button
          onClick={() => handleChange(quantity + 1)}
          disabled={isUnavailable || quantity >= maxQty}
          className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-lg disabled:opacity-30"
          aria-label="Increase quantity"
        >
          +
        </button>
      </div>
    </div>
  );
}
