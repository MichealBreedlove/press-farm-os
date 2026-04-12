"use client";

import { useState } from "react";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";
import { CATEGORY_LABELS } from "@/lib/constants";
import { ItemRow } from "./item-row";
import { cn } from "@/lib/utils";

interface CategorySectionProps {
  category: ItemCategory;
  items: AvailabilityItemWithItem[];
  quantities: Record<string, number>;
  itemNotes: Record<string, string>;
  itemColors: Record<string, string>;
  onQuantityChange: (key: string, qty: number) => void;
  onNoteChange: (id: string, note: string) => void;
  onColorChange: (id: string, color: string) => void;
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
    const sizes = (i.item as any).size ? (i.item as any).size.split(", ") : [];
    return sizes.some((s: string) => (quantities[`${i.id}__${s}`] ?? 0) > 0);
  }).length;

  return (
    <section className="mb-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-100 text-left transition-colors",
          isOpen ? "rounded-t-xl border-b-0" : "rounded-xl"
        )}
        style={{ minHeight: "44px" }}
      >
        <div className="flex items-center gap-2">
          <span className="font-display text-sm text-gray-900 tracking-tight">
            {CATEGORY_LABELS[category]}
          </span>
          {orderedCount > 0 && (
            <span className="bg-farm-green text-white text-xs px-1.5 py-0.5 rounded-full">
              {orderedCount}
            </span>
          )}
        </div>
        <span className="text-gray-400 text-sm" aria-hidden>
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div className="bg-white rounded-b-xl border border-t-0 border-gray-100 px-4">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              availabilityItem={item}
              quantities={quantities}
              itemNote={itemNotes[item.id] ?? ""}
              selectedColor={itemColors[item.id] ?? ""}
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
