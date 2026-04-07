"use client";

import { useState, useTransition } from "react";
import type { Item, AvailabilityItem, Restaurant } from "@/types";
import type { AvailabilityStatus, ItemCategory } from "@/types/database";
import { CATEGORY_ORDER, CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";

// ============================================
// Types
// ============================================

interface ItemState {
  status: AvailabilityStatus;
  limited_qty: string; // string for controlled input
  cycle_notes: string;
}

type ItemStates = Record<string, ItemState>; // keyed by item_id

interface AvailabilityEditorProps {
  items: Item[];
  availability: AvailabilityItem[];
  date: string;
  restaurants: Restaurant[];
}

// ============================================
// Helpers
// ============================================

function buildInitialState(items: Item[], availability: AvailabilityItem[]): ItemStates {
  const availMap: Record<string, AvailabilityItem> = {};
  for (const a of availability) {
    availMap[a.item_id] = a;
  }
  const state: ItemStates = {};
  for (const item of items) {
    const existing = availMap[item.id];
    state[item.id] = {
      status: existing?.status ?? "unavailable",
      limited_qty: existing?.limited_qty != null ? String(existing.limited_qty) : "",
      cycle_notes: existing?.cycle_notes ?? "",
    };
  }
  return state;
}

function StatusToggle({
  value,
  onChange,
}: {
  value: AvailabilityStatus;
  onChange: (v: AvailabilityStatus) => void;
}) {
  const options: { value: AvailabilityStatus; label: string; activeClass: string }[] = [
    { value: "available", label: "✓", activeClass: "bg-farm-green text-white" },
    { value: "limited", label: "⚠", activeClass: "bg-yellow-500 text-white" },
    { value: "unavailable", label: "✗", activeClass: "bg-gray-300 text-gray-600" },
  ];

  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`min-w-[44px] min-h-[44px] px-3 text-sm font-bold transition-colors ${
            value === opt.value
              ? opt.activeClass
              : "bg-white text-gray-400 hover:bg-gray-50 active:bg-gray-100"
          }`}
          aria-label={opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ============================================
// Main component
// ============================================

export function AvailabilityEditor({
  items,
  availability,
  date,
  restaurants,
}: AvailabilityEditorProps) {
  const [activeRestaurantId, setActiveRestaurantId] = useState<string>(
    restaurants[0]?.id ?? ""
  );
  // Per-restaurant state: outer key = restaurant_id, inner key = item_id
  const [allStates, setAllStates] = useState<Record<string, ItemStates>>(() => {
    const result: Record<string, ItemStates> = {};
    for (const r of restaurants) {
      const restaurantAvail = availability.filter((a) => a.restaurant_id === r.id);
      result[r.id] = buildInitialState(items, restaurantAvail);
    }
    return result;
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [duplicateSuccess, setDuplicateSuccess] = useState(false);

  const [isSaving, startSaving] = useTransition();
  const [isDuplicating, startDuplicating] = useTransition();

  const currentState = allStates[activeRestaurantId] ?? {};

  function updateItem(itemId: string, patch: Partial<ItemState>) {
    setAllStates((prev) => ({
      ...prev,
      [activeRestaurantId]: {
        ...prev[activeRestaurantId],
        [itemId]: {
          ...prev[activeRestaurantId]?.[itemId],
          ...patch,
        },
      },
    }));
  }

  function markAll(status: AvailabilityStatus) {
    setAllStates((prev) => {
      const updated: ItemStates = {};
      for (const [id, s] of Object.entries(prev[activeRestaurantId] ?? {})) {
        updated[id] = { ...s, status };
      }
      return { ...prev, [activeRestaurantId]: updated };
    });
  }

  function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);

    startSaving(async () => {
      const state = allStates[activeRestaurantId] ?? {};
      const payload = {
        restaurant_id: activeRestaurantId,
        delivery_date: date,
        items: Object.entries(state).map(([item_id, s]) => ({
          item_id,
          status: s.status,
          limited_qty:
            s.status === "limited" && s.limited_qty !== ""
              ? Number(s.limited_qty)
              : null,
          cycle_notes: s.cycle_notes || null,
        })),
      };

      try {
        const res = await fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setSaveError(data?.error ?? "Failed to save. Please try again.");
        } else {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      } catch {
        setSaveError("Network error. Please try again.");
      }
    });
  }

  function handleDuplicate() {
    setDuplicateError(null);
    setDuplicateSuccess(false);

    startDuplicating(async () => {
      try {
        const res = await fetch("/api/availability/duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurant_id: activeRestaurantId,
            target_date: date,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setDuplicateError(data?.error ?? "Failed to duplicate. Please try again.");
        } else {
          setDuplicateSuccess(true);
          // Reload the page to show duplicated data
          window.location.reload();
        }
      } catch {
        setDuplicateError("Network error. Please try again.");
      }
    });
  }

  // Group items by category
  const itemsByCategory: Partial<Record<ItemCategory, Item[]>> = {};
  for (const item of items) {
    if (!itemsByCategory[item.category]) {
      itemsByCategory[item.category] = [];
    }
    itemsByCategory[item.category]!.push(item);
  }

  return (
    <div>
      {/* Restaurant Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex">
          {restaurants.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveRestaurantId(r.id)}
              className={`flex-1 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
                activeRestaurantId === r.id
                  ? "border-farm-green text-farm-green"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex gap-2">
        <button
          type="button"
          onClick={() => markAll("available")}
          className="flex-1 py-2 rounded-lg bg-farm-green-light text-farm-green text-xs font-semibold active:opacity-80 transition-colors"
        >
          Mark All Available
        </button>
        <button
          type="button"
          onClick={() => markAll("unavailable")}
          className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-semibold active:bg-gray-300 transition-colors"
        >
          Mark All Unavailable
        </button>
      </div>

      {/* Item List by Category */}
      <div className="pb-4">
        {CATEGORY_ORDER.map((category) => {
          const categoryItems = itemsByCategory[category];
          if (!categoryItems || categoryItems.length === 0) return null;

          return (
            <div key={category}>
              <div className="px-4 py-2 bg-gray-100 border-b border-gray-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {CATEGORY_LABELS[category]}
                </h3>
              </div>

              <div className="divide-y divide-gray-100">
                {categoryItems.map((item) => {
                  const state = currentState[item.id] ?? {
                    status: "unavailable" as AvailabilityStatus,
                    limited_qty: "",
                    cycle_notes: "",
                  };

                  return (
                    <div key={item.id} className="px-4 py-3 bg-white">
                      <div className="flex items-center gap-3">
                        {/* Item info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {UNIT_LABELS[item.unit_type]}
                          </p>
                        </div>

                        {/* Status toggle */}
                        <StatusToggle
                          value={state.status}
                          onChange={(v) => updateItem(item.id, { status: v })}
                        />
                      </div>

                      {/* Limited qty + notes row */}
                      <div className="mt-2 flex gap-2">
                        {state.status === "limited" && (
                          <input
                            type="number"
                            min="0"
                            placeholder="Qty"
                            value={state.limited_qty}
                            onChange={(e) =>
                              updateItem(item.id, { limited_qty: e.target.value })
                            }
                            className="w-20 px-2 py-1.5 text-sm border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-yellow-50"
                          />
                        )}
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={state.cycle_notes}
                          onChange={(e) =>
                            updateItem(item.id, { cycle_notes: e.target.value })
                          }
                          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green bg-gray-50 placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky bottom action bar */}
      <div className="sticky bottom-16 bg-white border-t border-gray-200 px-4 py-3 space-y-2">
        {saveError && (
          <p className="text-xs text-red-600 text-center">{saveError}</p>
        )}
        {saveSuccess && (
          <p className="text-xs text-farm-green text-center font-medium">
            Saved successfully
          </p>
        )}
        {duplicateError && (
          <p className="text-xs text-red-600 text-center">{duplicateError}</p>
        )}
        {duplicateSuccess && (
          <p className="text-xs text-farm-green text-center font-medium">
            Duplicated from last cycle
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={isDuplicating}
            className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 bg-white active:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDuplicating ? "Duplicating…" : "Duplicate Last Cycle"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex-1 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving…" : "Save & Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
