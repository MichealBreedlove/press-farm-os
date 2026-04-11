"use client";

import type { AvailabilityItemWithItem } from "@/types";
import { UNIT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ItemRowProps {
  availabilityItem: AvailabilityItemWithItem;
  quantity: number;
  itemNote: string;
  onQuantityChange: (id: string, qty: number) => void;
  onNoteChange: (id: string, note: string) => void;
}

/**
 * ItemRow — single item in the chef order form.
 *
 * Shows: item name, unit label, LIMITED badge if applicable,
 * quantity stepper (44px touch targets), and an editable
 * cycle note that appears when qty > 0.
 */
export function ItemRow({
  availabilityItem,
  quantity,
  itemNote,
  onQuantityChange,
  onNoteChange,
}: ItemRowProps) {
  const { item, status, limited_qty, cycle_notes } = availabilityItem;
  const isUnavailable = status === "unavailable";
  const isLimited = status === "limited";
  const maxQty = isLimited ? (limited_qty ?? Infinity) : Infinity;

  const showNoteField = quantity > 0 || itemNote.length > 0;

  function handleChange(value: number) {
    const clamped = Math.max(0, Math.min(value, maxQty));
    onQuantityChange(availabilityItem.id, clamped);
  }

  return (
    <div
      className={cn(
        "py-3 border-b border-gray-100 last:border-0",
        isUnavailable && "opacity-50"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Item photo */}
        {(item as any).image_url && (
          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
            <img
              src={(item as any).image_url}
              alt={item.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900">{item.name}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {UNIT_LABELS[item.unit_type]}
            </span>
            {isLimited && (
              <span className="badge-gold flex-shrink-0">
                LIMITED
              </span>
            )}
            {(item as any).season_status === "ending_soon" && (
              <span className="badge-orange flex-shrink-0">ENDING SOON</span>
            )}
            {(item as any).season_status === "coming_soon" && (
              <span className="badge-blue flex-shrink-0">COMING SOON</span>
            )}
          </div>
          {/* Micheal's cycle note (read-only hint) */}
          {cycle_notes && (
            <p className="text-xs text-gray-400 italic mt-0.5 truncate">{cycle_notes}</p>
          )}
          {!cycle_notes && item.chef_notes && (
            <p className="text-xs text-gray-400 italic mt-0.5 truncate">{item.chef_notes}</p>
          )}
          {(item as any).season_note && (
            <p className="text-xs text-orange-500 mt-0.5 truncate">{(item as any).season_note}</p>
          )}
        </div>

        {/* Quantity stepper */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleChange(quantity - 1)}
            disabled={isUnavailable || quantity <= 0}
            className="w-11 h-11 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xl font-light disabled:opacity-30 active:bg-gray-200 transition-colors"
            aria-label={`Decrease quantity for ${item.name}`}
          >
            &minus;
          </button>
          <span
            className="w-10 text-center text-sm font-semibold text-gray-900 select-none"
            aria-label={`${quantity} ${UNIT_LABELS[item.unit_type]}`}
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => handleChange(quantity + 1)}
            disabled={isUnavailable || quantity >= maxQty}
            className="w-11 h-11 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xl font-light disabled:opacity-30 active:bg-gray-200 transition-colors"
            aria-label={`Increase quantity for ${item.name}`}
          >
            +
          </button>
        </div>
      </div>

      {/* Per-item note field — visible when qty > 0 or already has a note */}
      {showNoteField && !isUnavailable && (
        <div className="mt-2">
          <input
            type="text"
            value={itemNote}
            onChange={(e) => onNoteChange(availabilityItem.id, e.target.value)}
            placeholder="Add a note..."
            maxLength={200}
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent placeholder-gray-300"
            aria-label={`Note for ${item.name}`}
          />
        </div>
      )}
    </div>
  );
}
