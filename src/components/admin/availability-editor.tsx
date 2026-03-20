"use client";

import type { AvailabilityItem, Item } from "@/types";
import type { AvailabilityStatus } from "@/types";

/**
 * AvailabilityEditor — admin interface for setting item availability.
 *
 * Per item: status toggle (available/limited/unavailable), limited_qty input, cycle_notes.
 * Bulk actions: Mark All Available, Mark All Unavailable.
 * Duplicate Last Cycle button.
 * Publish button.
 *
 * Auto-saves on blur (no explicit save button per field per admin workflow doc).
 *
 * TODO: Build full UI in Phase 1
 */

interface AvailabilityEditorItem {
  item: Item;
  availability: Partial<AvailabilityItem>;
}

interface AvailabilityEditorProps {
  restaurantId: string;
  deliveryDate: string;
  items: AvailabilityEditorItem[];
  onSave: (
    itemId: string,
    update: {
      status: AvailabilityStatus;
      limited_qty?: number | null;
      cycle_notes?: string | null;
    }
  ) => Promise<void>;
  onDuplicateLastCycle: () => Promise<void>;
  onPublish: () => Promise<void>;
}

export function AvailabilityEditor({
  restaurantId,
  deliveryDate,
  items,
  onSave,
  onDuplicateLastCycle,
  onPublish,
}: AvailabilityEditorProps) {
  // Suppress unused parameter warnings during scaffold
  void restaurantId;
  void deliveryDate;
  void items;
  void onSave;
  void onDuplicateLastCycle;
  void onPublish;

  return (
    <div className="p-4">
      <p className="text-center text-gray-400 text-sm">
        AvailabilityEditor — TODO: implement in Phase 1
      </p>
    </div>
  );
}
