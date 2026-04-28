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
  size?: string | null;
  color?: string | null;
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

type AvailEntry = {
  status: AvailabilityStatus;
  limited_qty: string;
  cycle_notes: string;
  available_sizes: string | null;  // comma-separated, null = all
  available_colors: string | null; // comma-separated, null = all
};
type AvailMap = Record<string, AvailEntry>;

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
      available_sizes: (a as any).available_sizes ?? null,
      available_colors: (a as any).available_colors ?? null,
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
            ...current[itemId],
            status: nextStatus,
            limited_qty: current[itemId]?.limited_qty ?? "",
            cycle_notes: current[itemId]?.cycle_notes ?? "",
            available_sizes: current[itemId]?.available_sizes ?? null,
            available_colors: current[itemId]?.available_colors ?? null,
          },
        },
      };
    });
    setSaved(false);
  }, [activeRestaurantId]);

  const toggleSizeColor = useCallback((itemId: string, field: "available_sizes" | "available_colors", value: string, allValues: string[]) => {
    setAvailMaps((prev) => {
      const current = prev[activeRestaurantId] ?? {};
      const entry = current[itemId] ?? { status: "available", limited_qty: "", cycle_notes: "", available_sizes: null, available_colors: null };
      // Parse current selected values — null means "all selected"
      const currentSelected = entry[field] === null
        ? new Set(allValues)
        : new Set(entry[field]!.split(",").filter(Boolean));
      // Toggle
      if (currentSelected.has(value)) {
        currentSelected.delete(value);
      } else {
        currentSelected.add(value);
      }
      // If all are selected, store null (meaning "all available")
      const newValue = currentSelected.size === allValues.length ? null : Array.from(currentSelected).join(",");
      return {
        ...prev,
        [activeRestaurantId]: {
          ...current,
          [itemId]: { ...entry, [field]: newValue },
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
          available_sizes: v.available_sizes || null,
          available_colors: v.available_colors || null,
        })),
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

  async function handleCopyToRestaurant() {
    const otherRestaurants = restaurants.filter((r) => r.id !== activeRestaurantId);
    if (otherRestaurants.length === 0) return;
    const target = otherRestaurants.length === 1
      ? otherRestaurants[0]
      : otherRestaurants.find((r) => confirm(`Copy availability to ${r.name}?`));
    if (!target) return;

    const currentAvail = availMaps[activeRestaurantId] ?? {};
    const newMap: AvailMap = {};
    for (const [itemId, val] of Object.entries(currentAvail)) {
      newMap[itemId] = { ...val };
    }
    setAvailMaps((prev) => ({ ...prev, [target.id]: newMap }));
    alert(`Copied to ${target.name}. Click Save to apply.`);
  }

  async function handlePublishToAll() {
    if (!confirm("Save and publish this availability to ALL restaurants?")) return;
    setSaving(true);
    try {
      for (const r of restaurants) {
        // Use current restaurant's availability for all
        const map = availMaps[activeRestaurantId] ?? {};
        const body = {
          date,
          restaurantId: r.id,
          items: Object.entries(map).map(([itemId, v]) => ({
            item_id: itemId,
            status: v.status,
            limited_qty: v.limited_qty ? parseFloat(v.limited_qty) : null,
            cycle_notes: v.cycle_notes || null,
            available_sizes: v.available_sizes || null,
            available_colors: v.available_colors || null,
          })),
          allItemIds: items.map((i) => i.id),
        };
        const res = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Failed for ${r.name}`);
      }
      setSaved(true);
    } catch (err) {
      alert("Publish to all failed. Please try again.");
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
                        {item.size && (() => {
                          const allSizes = item.size!.split(", ").filter(Boolean);
                          const entry = avail[item.id];
                          const selectedSizes = entry?.available_sizes === null || entry?.available_sizes === undefined
                            ? new Set(allSizes)
                            : new Set(entry.available_sizes.split(",").filter(Boolean));
                          return (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span className="text-[9px] text-gray-400 mr-0.5">Sizes:</span>
                              {allSizes.map((s) => (
                                <button key={s} type="button"
                                  onClick={() => toggleSizeColor(item.id, "available_sizes", s, allSizes)}
                                  className={`text-[9px] px-1.5 py-0.5 rounded min-h-0 min-w-0 transition-colors ${
                                    selectedSizes.has(s)
                                      ? "bg-farm-green text-white"
                                      : "bg-gray-100 text-gray-400 line-through"
                                  }`}
                                >{s}</button>
                              ))}
                            </div>
                          );
                        })()}
                        {item.color && (() => {
                          const allColors = item.color!.split(", ").filter(Boolean);
                          const entry = avail[item.id];
                          const selectedColors = entry?.available_colors === null || entry?.available_colors === undefined
                            ? new Set(allColors)
                            : new Set(entry.available_colors.split(",").filter(Boolean));
                          return (
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              <span className="text-[9px] text-gray-400 mr-0.5">Colors:</span>
                              {allColors.map((c) => (
                                <button key={c} type="button"
                                  onClick={() => toggleSizeColor(item.id, "available_colors", c, allColors)}
                                  className={`text-[9px] px-1.5 py-0.5 rounded min-h-0 min-w-0 transition-colors ${
                                    selectedColors.has(c)
                                      ? "bg-purple-600 text-white"
                                      : "bg-gray-100 text-gray-400 line-through"
                                  }`}
                                >{c}</button>
                              ))}
                            </div>
                          );
                        })()}
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

      {/* Footer actions — fixed above bottom nav */}
      <div className="fixed bottom-nav-safe inset-x-0 px-4 py-3 bg-white shadow-nav z-40 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={handlePublish}
            disabled={saving}
            className={`flex-1 text-white text-sm font-medium py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50 ${
              saved ? "bg-farm-green-dark" : "bg-farm-green"
            }`}
          >
            {saving ? "Saving..." : saved ? "✓ Saved" : "Save"}
          </button>
          {restaurants.length > 1 && (
            <button
              onClick={handlePublishToAll}
              disabled={saving}
              className="flex-1 bg-farm-green text-white text-sm font-medium py-3 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {saving ? "..." : "Save & Publish to All"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDuplicateLast}
            disabled={saving}
            className="flex-1 bg-white border border-gray-200 text-gray-600 text-xs font-medium py-2.5 rounded-xl disabled:opacity-50"
          >
            Duplicate Last
          </button>
          {restaurants.length > 1 && (
            <button
              onClick={handleCopyToRestaurant}
              disabled={saving}
              className="flex-1 bg-white border border-gray-200 text-gray-600 text-xs font-medium py-2.5 rounded-xl disabled:opacity-50"
            >
              Copy to Other
            </button>
          )}
          <button
            onClick={handleToggleOrdering}
            className="flex-1 border border-gray-200 bg-white text-xs font-medium py-2.5 rounded-xl text-gray-600"
          >
            {orderingOpen ? "Close Ordering" : "Open Ordering"}
          </button>
        </div>
      </div>
    </div>
  );
}

