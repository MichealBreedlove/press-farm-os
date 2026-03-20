"use client";

import type { DeliveryDate } from "@/types";
import { formatDateShort } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface DeliveryDatePickerProps {
  dates: DeliveryDate[];
  selectedDate: string;
  onSelect: (date: string) => void;
  className?: string;
}

/**
 * DeliveryDatePicker — horizontal scrollable date selector.
 * Shows upcoming open delivery dates. Tapping selects a date.
 *
 * Used in: chef order form, admin availability, admin orders dashboard.
 *
 * TODO: Build full UI in Phase 1
 */
export function DeliveryDatePicker({
  dates,
  selectedDate,
  onSelect,
  className,
}: DeliveryDatePickerProps) {
  const openDates = dates.filter((d) => d.ordering_open);

  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1 -mx-4 px-4", className)}>
      {openDates.map((d) => (
        <button
          key={d.date}
          onClick={() => onSelect(d.date)}
          className={cn(
            "flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium border min-h-[44px]",
            selectedDate === d.date
              ? "bg-farm-green text-white border-farm-green"
              : "bg-white text-gray-700 border-gray-200"
          )}
        >
          {formatDateShort(d.date)}
        </button>
      ))}
    </div>
  );
}
