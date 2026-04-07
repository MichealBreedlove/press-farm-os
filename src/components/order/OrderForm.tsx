"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_ORDER, MAX_NOTES_LENGTH } from "@/lib/constants";
import { CategorySection } from "./category-section";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";

interface OrderFormProps {
  availabilityItems: AvailabilityItemWithItem[];
  restaurantId: string;
  restaurantName: string;
  deliveryDate: string;
  deliveryDateFormatted: string;
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
}

export function OrderForm({
  availabilityItems,
  restaurantId,
  restaurantName,
  deliveryDate,
  deliveryDateFormatted,
}: OrderFormProps) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [freeformNotes, setFreeformNotes] = useState("");

  // Filter to only available/limited items
  const visibleItems = availabilityItems.filter((ai) => ai.status !== "unavailable");

  // Group items by category
  const itemsByCategory = CATEGORY_ORDER.reduce<Record<ItemCategory, AvailabilityItemWithItem[]>>(
    (acc, cat) => {
      acc[cat] = visibleItems.filter((ai) => ai.item.category === cat);
      return acc;
    },
    {} as Record<ItemCategory, AvailabilityItemWithItem[]>
  );

  function handleQuantityChange(id: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [id]: qty }));
  }

  function handleNoteChange(id: string, note: string) {
    setItemNotes((prev) => ({ ...prev, [id]: note }));
  }

  const hasAnyOrdered = visibleItems.some((ai) => (quantities[ai.id] ?? 0) > 0);

  function handleReview() {
    const orderedItems = visibleItems
      .filter((ai) => (quantities[ai.id] ?? 0) > 0)
      .map((ai) => ({
        availabilityItemId: ai.id,
        itemName: ai.item.name,
        unitType: ai.item.unit_type,
        quantity: quantities[ai.id],
        unitPrice: ai.item.default_price ?? null,
        itemNote: itemNotes[ai.id] ?? "",
      }));

    const formData: OrderFormData = {
      restaurantId,
      restaurantName,
      deliveryDate,
      deliveryDateFormatted,
      items: orderedItems,
      freeformNotes,
    };

    sessionStorage.setItem("press_farm_order", JSON.stringify(formData));
    router.push("/order/review");
  }

  return (
    <div className="flex flex-col min-h-screen bg-farm-cream">
      <div className="flex-1 px-4 py-4 pb-32">
        {visibleItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No items available for this delivery.
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
                  onQuantityChange={handleQuantityChange}
                  onNoteChange={handleNoteChange}
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

      {/* Sticky review button */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-4 safe-area-bottom">
        <button
          type="button"
          onClick={handleReview}
          disabled={!hasAnyOrdered}
          className="w-full bg-farm-green text-white font-semibold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] transition-opacity"
        >
          Review Order
        </button>
      </div>
    </div>
  );
}
