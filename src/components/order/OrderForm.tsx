"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_ORDER, MAX_NOTES_LENGTH } from "@/lib/constants";
import { CategorySection } from "./category-section";
import { OnboardingTour } from "./OnboardingTour";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";

interface OrderFormProps {
  availabilityItems: AvailabilityItemWithItem[];
  restaurantId: string;
  restaurantName: string;
  deliveryDate: string;
  deliveryDateFormatted: string;
  initialQuantities?: Record<string, number>;
  initialNotes?: string;
  editingOrderId?: string;
}

export interface OrderFormData {
  restaurantId: string;
  restaurantName: string;
  deliveryDate: string;
  deliveryDateFormatted: string;
  items: {
    availabilityItemId: string;
    itemName: string;
    unitType: string;
    quantity: number;
    unitPrice: number | null;
    itemNote: string;
  }[];
  freeformNotes: string;
  editingOrderId?: string;
}

export function OrderForm({
  availabilityItems,
  restaurantId,
  restaurantName,
  deliveryDate,
  deliveryDateFormatted,
  initialQuantities = {},
  initialNotes = "",
  editingOrderId,
}: OrderFormProps) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [itemColors, setItemColors] = useState<Record<string, string>>({});
  const [freeformNotes, setFreeformNotes] = useState(initialNotes);
  const [search, setSearch] = useState("");

  // Filter to only available/limited items, then by search query
  const allAvailable = availabilityItems.filter((ai) => ai.status !== "unavailable");
  const visibleItems = search.trim()
    ? allAvailable.filter((ai) => ai.item.name.toLowerCase().includes(search.toLowerCase().trim()))
    : allAvailable;

  // Group filtered items by category (search-aware)
  const itemsByCategory = CATEGORY_ORDER.reduce<Record<ItemCategory, AvailabilityItemWithItem[]>>(
    (acc, cat) => {
      acc[cat] = visibleItems.filter((ai) => ai.item.category === cat);
      return acc;
    },
    {} as Record<ItemCategory, AvailabilityItemWithItem[]>
  );

  const isSearching = search.trim().length > 0;

  function handleQuantityChange(key: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [key]: qty }));
  }

  function handleNoteChange(id: string, note: string) {
    setItemNotes((prev) => ({ ...prev, [id]: note }));
  }

  // Check if any item has quantity > 0 (across ALL items, not just searched)
  const hasAnyOrdered = allAvailable.some((ai) => {
    if ((quantities[ai.id] ?? 0) > 0) return true;
    const sizes = (ai.item as any).size ? (ai.item as any).size.split(", ") : [];
    return sizes.some((s: string) => (quantities[`${ai.id}__${s}`] ?? 0) > 0);
  });

  // Total items with quantity > 0
  const orderedCount = allAvailable.reduce((count, ai) => {
    const sizes = (ai.item as any).size ? (ai.item as any).size.split(", ").filter(Boolean) : [];
    if (sizes.length > 0) {
      return count + sizes.filter((s: string) => (quantities[`${ai.id}__${s}`] ?? 0) > 0).length;
    }
    return count + ((quantities[ai.id] ?? 0) > 0 ? 1 : 0);
  }, 0);

  function handleReview() {
    const orderedItems: {
      availabilityItemId: string; itemName: string; unitType: string;
      quantity: number; unitPrice: number | null; itemNote: string;
    }[] = [];

    // Use allAvailable so search doesn't hide ordered items
    for (const ai of allAvailable) {
      const sizes = (ai.item as any).size ? (ai.item as any).size.split(", ").filter(Boolean) : [];
      const colorNote = itemColors[ai.id] ? `Color: ${itemColors[ai.id]}` : "";
      const note = [colorNote, itemNotes[ai.id] ?? ""].filter(Boolean).join(" | ");

      if (sizes.length > 0) {
        // Create one order item per size that has quantity > 0
        for (const size of sizes) {
          const qty = quantities[`${ai.id}__${size}`] ?? 0;
          if (qty > 0) {
            orderedItems.push({
              availabilityItemId: ai.id,
              itemName: `${ai.item.name} (${size})`,
              unitType: ai.item.unit_type,
              quantity: qty,
              unitPrice: ai.item.default_price ?? null,
              itemNote: note,
            });
          }
        }
      } else {
        // No sizes — single quantity
        const qty = quantities[ai.id] ?? 0;
        if (qty > 0) {
          orderedItems.push({
            availabilityItemId: ai.id,
            itemName: ai.item.name,
            unitType: ai.item.unit_type,
            quantity: qty,
            unitPrice: ai.item.default_price ?? null,
            itemNote: note,
          });
        }
      }
    }

    const formData: OrderFormData = {
      restaurantId,
      restaurantName,
      deliveryDate,
      deliveryDateFormatted,
      items: orderedItems,
      freeformNotes,
      editingOrderId,
    };

    sessionStorage.setItem("press_farm_order", JSON.stringify(formData));
    router.push("/order/review");
  }

  return (
    <div className="flex flex-col min-h-screen bg-farm-cream">
      {!editingOrderId && <OnboardingTour />}
      {editingOrderId && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2">
          <span className="text-xs text-amber-700 font-medium">Editing existing order — changes will replace your previous submission</span>
        </div>
      )}
      {/* Sticky search bar */}
      <div className="sticky top-0 z-30 bg-farm-cream/95 backdrop-blur-sm border-b border-gray-100 px-4 py-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 min-h-[44px] text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {orderedCount > 0 && (
          <p className="text-xs text-farm-green mt-1.5 px-1">
            {orderedCount} item{orderedCount !== 1 ? "s" : ""} in your order
          </p>
        )}
      </div>

      <div className="flex-1 px-4 py-4 pb-32">
        {visibleItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search ? `No items match "${search}"` : "No items available for this delivery."}
          </div>
        ) : (
          <>
            {CATEGORY_ORDER.map((cat) => {
              const catItems = itemsByCategory[cat];
              if (catItems.length === 0) return null;
              return (
                <CategorySection
                  key={cat}
                  category={cat}
                  items={catItems}
                  quantities={quantities}
                  itemNotes={itemNotes}
                  itemColors={itemColors}
                  onQuantityChange={handleQuantityChange}
                  onNoteChange={handleNoteChange}
                  onColorChange={(id, color) => setItemColors((prev) => ({ ...prev, [id]: color }))}
                />
              );
            })}

            {/* General notes */}
            <div className="card px-4 py-4 mt-2">
              <label
                htmlFor="freeform-notes"
                className="block text-sm font-semibold text-gray-900 mb-2"
              >
                Notes for Micheal
              </label>
              <textarea
                id="freeform-notes"
                value={freeformNotes}
                onChange={(e) => setFreeformNotes(e.target.value)}
                maxLength={MAX_NOTES_LENGTH}
                rows={3}
                placeholder="Any special requests or substitutions..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1 text-right">
                {freeformNotes.length}/{MAX_NOTES_LENGTH}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Sticky review button — above ChefNav (h-16 = 64px) */}
      <div className="fixed bottom-nav-safe inset-x-0 bg-white shadow-nav px-4 py-3 z-40">
        <button
          type="button"
          onClick={handleReview}
          disabled={!hasAnyOrdered}
          className="w-full bg-farm-green text-white font-semibold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] transition-opacity"
        >
          {editingOrderId ? "Review Changes" : "Review Order"}
        </button>
      </div>
    </div>
  );
}
