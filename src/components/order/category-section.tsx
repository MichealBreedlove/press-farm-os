"use client";

import { Fragment, useState } from "react";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";
import { CATEGORY_LABELS, EVENT_MENU_KEY_PREFIX } from "@/lib/constants";
import { ItemRow } from "./item-row";
import { cn } from "@/lib/utils";
import { resolveSizes } from "@/lib/order-availability";
import { buildOrderKey } from "@/lib/order-keys";

interface CategorySectionProps {
  category: ItemCategory;
  items: AvailabilityItemWithItem[];
  quantities: Record<string, number>;
  itemNotes: Record<string, string>;
  itemColors: Record<string, string[]>;
  onQuantityChange: (key: string, qty: number) => void;
  onNoteChange: (id: string, note: string) => void;
  onColorChange: (key: string, colors: string[]) => void;
  /** Per-item "For an event" checkmark state, keyed by availability id.
   *  Omitted for the Press Bar section, where event marking doesn't apply. */
  eventChecked?: Record<string, boolean>;
  onEventToggle?: (id: string, checked: boolean) => void;
  /** Items whose regular/event split is open — each renders an extra
   *  "Event portion" sub-row keyed under a prefixed clone id. */
  splitOpen?: Record<string, boolean>;
  onOpenSplit?: (id: string) => void;
  onCloseSplit?: (id: string) => void;
}

export function CategorySection({
  category,
  items,
  quantities,
  itemNotes,
  itemColors,
  onQuantityChange,
  onNoteChange,
  onColorChange,
  eventChecked,
  onEventToggle,
  splitOpen,
  onOpenSplit,
  onCloseSplit,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const orderedCount = items.filter((i) => {
    if ((quantities[i.id] ?? 0) > 0) return true;
    const sizes = resolveSizes(i.item, i.available_sizes);
    return sizes.some((s: string) => (quantities[buildOrderKey(i.id, { size: s })] ?? 0) > 0);
  }).length;

  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 bg-white border border-farm-dark/5 text-left transition-colors",
          isOpen ? "rounded-t-xl border-b-0" : "rounded-xl"
        )}
        style={{ minHeight: "44px" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-display text-sm text-farm-dark tracking-tight">
            {CATEGORY_LABELS[category]}
          </span>
          {orderedCount > 0 && (
            <span className="bg-farm-green text-white text-xs px-1.5 py-0.5 rounded-full">
              {orderedCount}
            </span>
          )}
        </div>
        <span className="text-farm-muted text-sm" aria-hidden>
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div className="bg-white rounded-b-xl border border-t-0 border-farm-dark/5 px-4">
          {items.map((item) => {
            const isSplit = splitOpen?.[item.id] ?? false;
            const eventCopyId = `${EVENT_MENU_KEY_PREFIX}${item.id}`;
            return (
              <Fragment key={item.id}>
                <ItemRow
                  availabilityItem={item}
                  quantities={quantities}
                  itemNote={itemNotes[item.id] ?? ""}
                  itemColors={itemColors}
                  onQuantityChange={onQuantityChange}
                  onNoteChange={onNoteChange}
                  onColorChange={onColorChange}
                  eventChecked={eventChecked?.[item.id] ?? false}
                  onEventToggle={onEventToggle}
                  splitOpen={isSplit}
                  onOpenSplit={onOpenSplit}
                />
                {isSplit && (
                  <div className="my-2 rounded-lg border border-pf-master-violet/25 bg-pf-master-violet/[0.04] px-3">
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] tracking-[0.18em] uppercase text-pf-master-violet font-semibold">
                        Event portion
                      </span>
                      <button
                        type="button"
                        onClick={() => onCloseSplit?.(item.id)}
                        className="text-xs text-farm-muted hover:text-red-700 min-h-[32px] px-2"
                      >
                        Remove
                      </button>
                    </div>
                    {/* All of ItemRow's quantity/color/note keys derive from
                        availabilityItem.id, so a clone with the prefixed id
                        keeps this portion fully independent of the row above. */}
                    <ItemRow
                      availabilityItem={{ ...item, id: eventCopyId }}
                      quantities={quantities}
                      itemNote={itemNotes[eventCopyId] ?? ""}
                      itemColors={itemColors}
                      onQuantityChange={onQuantityChange}
                      onNoteChange={onNoteChange}
                      onColorChange={onColorChange}
                      isEventCopy
                    />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
