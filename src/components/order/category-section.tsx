"use client";

import { useState } from "react";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";
import { CATEGORY_LABELS } from "@/lib/constants";
import { ItemRow } from "./item-row";
import { cn } from "@/lib/utils";
import { resolveSizes } from "@/lib/order-availability";

interface CategorySectionProps {
  category: ItemCategory;
  items: AvailabilityItemWithItem[];
  quantities: Record<string, number>;
  itemNotes: Record<string, string>;
  itemColors: Record<string, string[]>;
  onQuantityChange: (key: string, qty: number) => void;
  onNoteChange: (id: string, note: string) => void;
  onColorChange: (key: string, colors: string[]) => void;
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
}: CategorySectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  const orderedCount = items.filter((i) => {
    if ((quantities[i.id] ?? 0) > 0) return true;
    const sizes = resolveSizes(i.item, (i as any).available_sizes);
    return sizes.some((s: string) => (quantities[`${i.id}__${s}`] ?? 0) > 0);
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
          {items.map((item) => (
            <ItemRow
              key={item.id}
              availabilityItem={item}
              quantities={quantities}
              itemNote={itemNotes[item.id] ?? ""}
              itemColors={itemColors}
              onQuantityChange={onQuantityChange}
              onNoteChange={onNoteChange}
              onColorChange={onColorChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}
