"use client";

import { useState, useCallback } from "react";
import { CATEGORY_ORDER, CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";
import type { ItemCategory, UnitType } from "@/types/database";

interface AvailabilityItem {
  id: string;
  status: "available" | "limited";
  limited_qty: number | null;
  cycle_notes: string | null;
  item_id: string;
  items: {
    id: string;
    name: string;
    category: ItemCategory;
    unit_type: UnitType;
    chef_notes: string | null;
    default_price: number | null;
  } | null;
}

interface ExistingOrderItem {
  id: string;
  availability_item_id: string;
  quantity_requested: number;
}

interface ExistingOrder {
  id: string;
  status: string;
  freeform_notes: string | null;
  order_items: ExistingOrderItem[];
}

interface Props {
  restaurantId: string;
  restaurantName: string;
  deliveryDate: string;
  availabilityItems: AvailabilityItem[];
  existingOrder: ExistingOrder | null;
  userId: string;
}

export default function OrderFormClient({
  restaurantId,
  deliveryDate,
  availabilityItems,
  existingOrder,
}: Props) {
  // Build initial quantities from existing order
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const q: Record<string, string> = {};
    existingOrder?.order_items?.forEach((oi) => {
      q[oi.availability_item_id] = String(oi.quantity_requested);
    });
    return q;
  });
  const [notes, setNotes] = useState(existingOrder?.freeform_notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ItemCategory | "all">("all");

  const updateQty = useCallback((availId: string, val: string) => {
    setQuantities((prev) => ({ ...prev, [availId]: val }));
  }, []);

  const totalItems = Object.values(quantities).filter((q) => parseFloat(q) > 0).length;

  async function handleSubmit() {
    const items = Object.entries(quantities)
      .filter(([, qty]) => parseFloat(qty) > 0)
      .map(([availability_item_id, qty]) => ({
        availability_item_id,
        quantity_requested: parseFloat(qty),
      }));

    if (!items.length && !notes.trim()) {
      alert("Add at least one item before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          delivery_date: deliveryDate,
          items,
          freeform_notes: notes.trim() || null,
          order_id: existingOrder?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error("Submit failed");
      setSubmitted(true);
      window.location.href = "/order/confirmed";
    } catch {
      alert("Failed to submit order. Please try again.");
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <p className="text-5xl mb-4">✅</p>
        <p className="font-semibold text-gray-700">Order submitted!</p>
      </div>
    );
  }

  const categories = CATEGORY_ORDER.filter((cat) =>
    availabilityItems.some((a) => a.items?.category === cat)
  );

  const filteredItems =
    activeCategory === "all"
      ? availabilityItems
      : availabilityItems.filter((a) => a.items?.category === activeCategory);

  const itemsByCategory = CATEGORY_ORDER.reduce<Record<string, AvailabilityItem[]>>((acc, cat) => {
    const catItems = filteredItems.filter((a) => a.items?.category === cat);
    if (catItems.length) acc[cat] = catItems;
    return acc;
  }, {});

  if (!availabilityItems.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <p className="text-4xl mb-3">🌱</p>
        <p className="text-gray-600 font-medium">No items available yet</p>
        <p className="text-sm text-gray-400 mt-1">The farm hasn&apos;t published availability.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Category filter */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto bg-white border-b border-gray-100 scrollbar-none">
        <button
          onClick={() => setActiveCategory("all")}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            activeCategory === "all"
              ? "bg-farm-green text-white border-farm-green"
              : "bg-white text-gray-500 border-gray-200"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeCategory === cat
                ? "bg-farm-green text-white border-farm-green"
                : "bg-white text-gray-500 border-gray-200"
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Item list */}
      <div className="px-4 py-3 space-y-6">
        {Object.entries(itemsByCategory).map(([cat, catItems]) => (
          <div key={cat}>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
              {CATEGORY_LABELS[cat as ItemCategory]}
            </h2>
            <div className="space-y-2">
              {catItems.map((avail) => {
                const item = avail.items;
                if (!item) return null;
                const qty = quantities[avail.id] ?? "";
                const hasQty = parseFloat(qty) > 0;
                const isLimited = avail.status === "limited";
                return (
                  <div
                    key={avail.id}
                    className={`bg-white rounded-xl border px-4 py-3 transition-all ${
                      hasQty ? "border-farm-green/30 bg-green-50/30" : "border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 leading-tight">
                          {item.name}
                          {isLimited && (
                            <span className="ml-1.5 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                              Limited
                              {avail.limited_qty ? ` (${avail.limited_qty})` : ""}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 uppercase">{item.unit_type}</p>
                        {avail.cycle_notes && (
                          <p className="text-xs text-yellow-700 mt-0.5 italic">{avail.cycle_notes}</p>
                        )}
                        {item.chef_notes && (
                          <p className="text-xs text-gray-400 mt-0.5 italic">{item.chef_notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const cur = parseFloat(qty) || 0;
                            updateQty(avail.id, cur > 0 ? String(cur - 1) : "");
                          }}
                          className="w-9 h-9 rounded-full border border-gray-200 text-gray-600 text-lg flex items-center justify-center active:scale-95 transition-transform"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={qty}
                          onChange={(e) => updateQty(avail.id, e.target.value)}
                          placeholder="0"
                          className={`w-12 text-center text-base font-semibold border rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-farm-green ${
                            hasQty ? "border-farm-green text-farm-green" : "border-gray-200 text-gray-400"
                          }`}
                        />
                        <button
                          onClick={() => {
                            const cur = parseFloat(qty) || 0;
                            updateQty(avail.id, String(cur + 1));
                          }}
                          className="w-9 h-9 rounded-full bg-farm-green text-white text-lg flex items-center justify-center active:scale-95 transition-transform"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Notes */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">
            Notes / Special Requests
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special requests, substitutions, or notes for the farm..."
            rows={3}
            maxLength={1000}
            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-farm-green resize-none"
          />
        </div>
      </div>

      {/* Submit bar */}
      <div className="sticky bottom-0 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-50 to-transparent">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-farm-green text-white text-base font-semibold py-4 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-farm-green/20"
        >
          {submitting
            ? "Submitting..."
            : totalItems > 0
            ? `Submit Order · ${totalItems} item${totalItems !== 1 ? "s" : ""}`
            : "Submit Order"}
        </button>
      </div>
    </div>
  );
}
