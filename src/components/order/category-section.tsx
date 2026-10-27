"use client";

import { Fragment, useState } from "react";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";
import { CATEGORY_LABELS, EVENT_MENU_KEY_PREFIX } from "@/lib/constants";
import { ItemRow } from "./item-row";
import { cn } from "@/lib/utils";
import { enumerateCells } from "@/lib/order/lines";

/** Every map key one row reads: its enumerated cell keys (unit/size aware)
 *  plus the bare row id, which whole-item color/variety pickers use. */
function rowKeys(ai: AvailabilityItemWithItem): string[] {
  const keys = [ai.id];
  for (const { key } of enumerateCells(ai)) if (key !== ai.id) keys.push(key);
  return keys;
}

/** The subset of a form-wide map this row reads. ItemRow is memoized on
 *  the CONTENT of these slices, so rebuilding them each render is fine —
 *  only a row whose own values moved re-renders. */
function sliceRow<T>(map: Record<string, T>, keys: string[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const k of keys) if (map[k] !== undefined) out[k] = map[k];
  return out;
}

interface CategorySectionProps {
  category: ItemCategory;
  items: AvailabilityItemWithItem[];
  quantities: Record<string, number>;
  itemNotes: Record<string, string>;
  itemColors: Record<string, string[]>;
  itemVarieties: Record<string, string[]>;
  onQuantityChange: (key: string, qty: number) => void;
  onNoteChange: (id: string, note: string) => void;
  onColorChange: (key: string, colors: string[]) => void;
  onVarietyChange: (key: string, varieties: string[]) => void;
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
  itemVarieties,
  onQuantityChange,
  onNoteChange,
  onColorChange,
  onVarietyChange,
  eventChecked,
  onEventToggle,
  splitOpen,
  onOpenSplit,
  onCloseSplit,
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Items in this category with anything ordered, counted over the SAME
  // cells the rows render (multi-unit keys included — the old check only
  // knew the bare id and size keys, so a "2 LG" line didn't light the badge).
  // A split item's event portion counts toward the same item.
  const orderedCount = items.filter((i) => {
    const keys = rowKeys(i);
    if (splitOpen?.[i.id]) keys.push(...rowKeys({ ...i, id: `${EVENT_MENU_KEY_PREFIX}${i.id}` }));
    return keys.some((k) => (quantities[k] ?? 0) > 0);
  }).length;

  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
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
            const keys = rowKeys(item);
            const eventCopy = isSplit ? { ...item, id: eventCopyId } : null;
            const eventKeys = eventCopy ? rowKeys(eventCopy) : [];
            return (
              <Fragment key={item.id}>
                <ItemRow
                  availabilityItem={item}
                  quantities={sliceRow(quantities, keys)}
                  itemNote={itemNotes[item.id] ?? ""}
                  itemColors={sliceRow(itemColors, keys)}
                  itemVarieties={sliceRow(itemVarieties, keys)}
                  onQuantityChange={onQuantityChange}
                  onNoteChange={onNoteChange}
                  onColorChange={onColorChange}
                  onVarietyChange={onVarietyChange}
                  eventChecked={eventChecked?.[item.id] ?? false}
                  onEventToggle={onEventToggle}
                  splitOpen={isSplit}
                  onOpenSplit={onOpenSplit}
                />
                {eventCopy && (
                  <div className="my-2 rounded-lg border border-pf-master-violet/25 bg-pf-master-violet/[0.04] px-3">
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-[10px] tracking-[0.18em] uppercase text-pf-master-violet font-semibold">
                        Event portion
                      </span>
                      <button
                        type="button"
                        onClick={() => onCloseSplit?.(item.id)}
                        aria-label={`Remove event portion of ${item.item.name}`}
                        className="text-xs text-farm-muted hover:text-red-700 min-h-[44px] min-w-[44px] px-2 inline-flex items-center justify-center"
                      >
                        Remove
                      </button>
                    </div>
                    {/* All of ItemRow's quantity/color/note keys derive from
                        availabilityItem.id, so a clone with the prefixed id
                        keeps this portion fully independent of the row above.
                        (The clone is a fresh object each render, so this one
                        sub-row doesn't benefit from ItemRow's memo — it's a
                        single row per split, not the whole list.) */}
                    <ItemRow
                      availabilityItem={eventCopy}
                      quantities={sliceRow(quantities, eventKeys)}
                      itemNote={itemNotes[eventCopyId] ?? ""}
                      itemColors={sliceRow(itemColors, eventKeys)}
                      itemVarieties={sliceRow(itemVarieties, eventKeys)}
                      onQuantityChange={onQuantityChange}
                      onNoteChange={onNoteChange}
                      onColorChange={onColorChange}
                      onVarietyChange={onVarietyChange}
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
