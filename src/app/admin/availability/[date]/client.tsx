"use client";

import { useState, useCallback } from "react";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/constants";
import type { ItemCategory, AvailabilityStatus } from "@/types/database";

interface Item {
  id: string;
  name: string;
  category: ItemCategory;
  unit_type: string;
  chef_notes: string | null;
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

interface AvailabilityItem {
  id: string;
  item_id: string;
  restaurant_id: string;
  delivery_date: string;
  status: AvailabilityStatus;
  limited_qty: number | null;
  cycle_notes: string | null;
}

interface Props {
  date: string;
  orderingOpen: boolean;
  items: Item[];
  restaurants: Restaurant[];
  initialAvailability: AvailabilityItem[];
}

type AvailMap = Record<string, { status: AvailabilityStatus; limited_qty: string; cycle_notes: string }>;

const STATUS_CYCLE: AvailabilityStatus[] = ["available", "limited", "unavailable"];

const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  available: "bg-farm-green-light text-farm-green border-farm-green/20",
  limited: "bg-yellow-100 text-yellow-800 border-yellow-200",
  unavailable: "bg-red-100 text-red-600 border-red-200 line-through",
};

const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: "Available",
  limited: "Limited",
  unavailable: "Unavailable",
};

function buildAvailMap(avail: AvailabilityItem[], restaurantId: string): AvailMap {
  const map: AvailMap = {};
  avail.filter((a) => a.restaurant_id === restaurantId).forEach((a) => {
    map[a.item_id] = {
      status: a.status,
      limited_qty: a.limited_qty?.toString() ?? "",
      cycle_notes: a.cycle_notes ?? "",
    };
  });
  return map;
}

export default function AvailabilityEditorClient({
  date,
  orderingOpen,
  items,
  restaurants,
  initialAvailability,
}: Props) {
  const [activeRestaurantId, setActiveRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [availMaps, setAvailMaps] = useState<Record<string, AvailMap>>(() => {
    const maps: Record<string, AvailMap> = {};
    restaurants.forEach((r) => {
      maps[r.id] = buildAvailMap(initialAvailability, r.id);
    });
    return maps;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ItemCategory | "all">("all");

  const avail = availMaps[activeRestaurantId] ?? {};

  const getStatus = (itemId: string): AvailabilityStatus =>
    avail[itemId]?.status ?? "available";

  const toggleStatus = useCallback((itemId: string) => {
    setAvailMaps((prev) => {
      const current = prev[activeRestaurantId] ?? {};
      const currentStatus = current[itemId]?.status ?? "available";
      const nextStatus = STATUS_CYCLE[(STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length];
      return {
        ...prev,
        [activeRestaurantId]: {
          ...current,
          [itemId]: {
            status: nextStatus,
            limited_qty: current[itemId]?.limited_qty ?? "",
            cycle_notes: current[itemId]?.cycle_notes ?? "",
          },
        },
      };
    });
    setSaved(false);
  }, [activeRestaurantId]);

  const updateField = useCallback((itemId: string, field: "limited_qty" | "cycle_notes", value: string) => {
    setAvailMaps((prev) => {
      const current = prev[activeRestaurantId] ?? {};
      return {
        ...prev,
        [activeRestaurantId]: {
          ...current,
          [itemId]: {
            ...current[itemId],
            status: current[itemId]?.status ?? "available",
            limited_qty: current[itemId]?.limited_qty ?? "",
            cycle_notes: current[itemId]?.cycle_notes ?? "",
            [field]: value,
          },
        },
      };
    });
    setSaved(false);
  }, [activeRestaurantId]);

  async function handlePublish() {
    setSaving(true);
    try {
      const body = {
        date,
        restaurantId: activeRestaurantId,
        items: Object.entries(avail).map(([itemId, v]) => ({
          item_id: itemId,
          status: v.status,
          limited_qty: v.limited_qty ? parseFloat(v.limited_qty) : null,
          cycle_notes: v.cycle_notes || null,
        })),
        // Mark items not in map as available (default)
        allItemIds: items.map((i) => i.id),
      };
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      setSaved(true);
    } catch (err) {
      alert("Save failed. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDuplicateLast() {
    if (!confirm("Copy availability from the previous delivery date?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/availability/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, restaurantId: activeRestaurantId }),
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      const { availability: newAvail } = await res.json();
      setAvailMaps((prev) => ({
        ...prev,
        [activeRestaurantId]: buildAvailMap(newAvail, activeRestaurantId),
      }));
    } catch (err) {
      alert("Duplicate failed. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleOrdering() {
    await fetch(`/api/availability/ordering`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, open: !orderingOpen }),
    });
    window.location.reload();
  }

  const categories = CATEGORY_ORDER.filter((cat) =>
    items.some((i) => i.category === cat)
  );

  const filteredItems =
    activeCategory === "all"
      ? items
      : items.filter((i) => i.category === activeCategory);

  const itemsByCategory = CATEGORY_ORDER.reduce<Record<string, Item[]>>((acc, cat) => {
    const catItems = filteredItems.filter((i) => i.category === cat);
    if (catItems.length) acc[cat] = catItems;
    return acc;
  }, {});

  return (
    <div>
      {/* Restaurant tabs */}
      {restaurants.length > 1 && (
        <div className="flex bg-white border-b border-gray-100 px-4 gap-4">
          {restaurants.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRestaurantId(r.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeRestaurantId === r.id
                  ? "border-farm-green text-farm-green"
                  : "border-transparent text-gray-400"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {/* Category filter pills */}
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
            <div className="space-y-1.5">
              {catItems.map((item) => {
                const status = getStatus(item.id);
                const isLimited = status === "limited";
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border px-4 py-3 ${STATUS_STYLES[status]}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm leading-tight ${status === "unavailable" ? "text-gray-400" : "text-gray-900"}`}>
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 uppercase">{item.unit_type}</p>
                      </div>
                      <button
                        onClick={() => toggleStatus(item.id)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${STATUS_STYLES[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </button>
                    </div>
                    {isLimited && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          placeholder="Qty limit"
                          value={avail[item.id]?.limited_qty ?? ""}
                          onChange={(e) => updateField(item.id, "limited_qty", e.target.value)}
                          className="w-24 text-sm border border-yellow-200 rounded-lg px-2 py-1.5 bg-yellow-50 text-yellow-900 placeholder-yellow-400 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Note for chef..."
                          value={avail[item.id]?.cycle_notes ?? ""}
                          onChange={(e) => updateField(item.id, "cycle_notes", e.target.value)}
                          className="flex-1 text-sm border border-yellow-200 rounded-lg px-2 py-1.5 bg-yellow-50 text-yellow-900 placeholder-yellow-400 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {!items.length && (
          <p className="text-center text-gray-400 text-sm py-8">
            No items in catalog yet.
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-20 px-4 pb-4 pt-2 bg-gradient-to-t from-gray-50 to-transparent">
        <div className="flex gap-2">
          <button
            onClick={handleDuplicateLast}
            disabled={saving}
            className="flex-1 bg-white border border-gray-200 text-gray-700 text-sm font-medium py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            Duplicate Last
          </button>
          <button
            onClick={handlePublish}
            disabled={saving}
            className={`flex-1 text-white text-sm font-medium py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50 ${
              saved ? "bg-farm-green-dark" : "bg-farm-green"
            }`}
          >
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save Availability"}
          </button>
        </div>
        <button
          onClick={handleToggleOrdering}
          className="w-full mt-2 border border-gray-200 bg-white text-xs font-medium py-2.5 rounded-xl text-gray-500 active:scale-95 transition-transform"
        >
          {orderingOpen ? "Close Ordering for Chefs" : "Open Ordering for Chefs"}
        </button>
      </div>
    </div>
  );
}
