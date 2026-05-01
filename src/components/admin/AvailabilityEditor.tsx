"use client";

import { useState, useTransition, useCallback } from "react";
import type { Item, AvailabilityItem, Restaurant } from "@/types";
import type { AvailabilityStatus, ItemCategory, UnitType } from "@/types/database";
import { CATEGORY_ORDER, CATEGORY_LABELS, UNIT_LABELS } from "@/lib/constants";

/** Parse a comma-separated unit_type field into individual unit codes. */
function parseUnits(unitType: string | null | undefined): UnitType[] {
  return String(unitType ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean) as UnitType[];
}

// ============================================
// Types
// ============================================

interface ItemState {
  status: AvailabilityStatus;
  limited_qty: string;
  cycle_notes: string;
  available_sizes: string | null;
  available_colors: string | null;
  available_units: string | null;
}

type ItemStates = Record<string, ItemState>;

// Override = only the fields that differ from base
type Overrides = Record<string, Record<string, Partial<ItemState>>>;

interface AvailabilityEditorProps {
  items: Item[];
  availability: AvailabilityItem[];
  date: string;
  restaurants: Restaurant[];
}

const DEFAULT_STATE: ItemState = {
  status: "unavailable",
  limited_qty: "",
  cycle_notes: "",
  available_sizes: null,
  available_colors: null,
  available_units: null,
};

// ============================================
// Helpers
// ============================================

function buildStatesForRestaurant(items: Item[], availability: AvailabilityItem[]): ItemStates {
  const availMap: Record<string, AvailabilityItem> = {};
  for (const a of availability) availMap[a.item_id] = a;
  const state: ItemStates = {};
  for (const item of items) {
    const e = availMap[item.id];
    state[item.id] = {
      status: e?.status ?? "unavailable",
      limited_qty: e?.limited_qty != null ? String(e.limited_qty) : "",
      cycle_notes: e?.cycle_notes ?? "",
      available_sizes: (e as any)?.available_sizes ?? null,
      available_colors: (e as any)?.available_colors ?? null,
      available_units: (e as any)?.available_units ?? null,
    };
  }
  return state;
}

function statesEqual(a: ItemState | undefined, b: ItemState | undefined): boolean {
  if (!a || !b) return false;
  return a.status === b.status
    && a.limited_qty === b.limited_qty
    && a.cycle_notes === b.cycle_notes
    && a.available_sizes === b.available_sizes
    && a.available_colors === b.available_colors
    && a.available_units === b.available_units;
}

// Derive base (most common state) and overrides from per-restaurant states
function deriveBaseAndOverrides(
  allStates: Record<string, ItemStates>,
  restaurants: Restaurant[],
  items: Item[]
): { base: ItemStates; overrides: Overrides } {
  const base: ItemStates = {};
  const overrides: Overrides = {};
  restaurants.forEach(r => { overrides[r.id] = {}; });

  for (const item of items) {
    // Use first restaurant's state as base
    const firstState = allStates[restaurants[0]?.id]?.[item.id] ?? DEFAULT_STATE;
    base[item.id] = { ...firstState };

    // Check if other restaurants differ
    for (const r of restaurants.slice(1)) {
      const rState = allStates[r.id]?.[item.id] ?? DEFAULT_STATE;
      if (!statesEqual(firstState, rState)) {
        overrides[r.id][item.id] = { ...rState };
      }
    }
  }
  return { base, overrides };
}

function StatusToggle({ value, onChange }: { value: AvailabilityStatus; onChange: (v: AvailabilityStatus) => void }) {
  const options: { value: AvailabilityStatus; label: string; activeClass: string }[] = [
    { value: "available", label: "✓", activeClass: "bg-farm-green text-white" },
    { value: "limited", label: "⚠", activeClass: "bg-amber-500 text-white" },
    { value: "unavailable", label: "✗", activeClass: "bg-gray-300 text-farm-muted/90" },
  ];
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-farm-dark/10 shrink-0">
      {options.map((opt) => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`min-w-[36px] min-h-[36px] px-2 text-sm font-bold transition-colors ${
            value === opt.value ? opt.activeClass : "bg-white text-farm-muted hover:bg-farm-cream/40"
          }`}
          aria-label={opt.value}
        >{opt.label}</button>
      ))}
    </div>
  );
}

const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: "Available",
  limited: "Limited",
  unavailable: "Unavailable",
};

const STATUS_PILL: Record<AvailabilityStatus, string> = {
  available: "bg-green-100 text-green-700",
  limited: "bg-amber-100 text-amber-700",
  unavailable: "bg-farm-cream/60 text-farm-muted",
};

// ============================================
// Main component
// ============================================

export function AvailabilityEditor({ items, availability, date, restaurants }: AvailabilityEditorProps) {
  // "all" = unified mode, or a restaurant ID for per-restaurant editing
  const [editMode, setEditMode] = useState<"all" | string>("all");

  // Per-restaurant states (used in single-restaurant mode)
  const [allStates, setAllStates] = useState<Record<string, ItemStates>>(() => {
    const result: Record<string, ItemStates> = {};
    for (const r of restaurants) {
      result[r.id] = buildStatesForRestaurant(items, availability.filter(a => a.restaurant_id === r.id));
    }
    return result;
  });

  // "All" mode: base state + per-restaurant overrides
  const [baseStates, setBaseStates] = useState<ItemStates>(() => {
    const { base } = deriveBaseAndOverrides(allStates, restaurants, items);
    return base;
  });
  const [overrides, setOverrides] = useState<Overrides>(() => {
    const { overrides: ov } = deriveBaseAndOverrides(allStates, restaurants, items);
    return ov;
  });

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isDuplicating, startDuplicating] = useTransition();
  const [search, setSearch] = useState("");

  // Filter items by search query
  const filteredItems = search.trim()
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase().trim()))
    : items;
  const isSearching = search.trim().length > 0;

  // ── All mode helpers ──

  const updateBase = useCallback((itemId: string, patch: Partial<ItemState>) => {
    setBaseStates(prev => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
    setSaveSuccess(false);
  }, []);

  const toggleBaseSizeColor = useCallback((itemId: string, field: "available_sizes" | "available_colors" | "available_units", value: string, allValues: string[]) => {
    setBaseStates(prev => {
      const current = prev[itemId];
      if (!current) return prev;
      const selected = current[field] === null ? new Set(allValues) : new Set(current[field]!.split(",").filter(Boolean));
      if (selected.has(value)) selected.delete(value); else selected.add(value);
      return { ...prev, [itemId]: { ...current, [field]: selected.size === allValues.length ? null : Array.from(selected).join(",") } };
    });
    setSaveSuccess(false);
  }, []);

  const addOverride = useCallback((restaurantId: string, itemId: string, status: AvailabilityStatus) => {
    setOverrides(prev => ({
      ...prev,
      [restaurantId]: { ...prev[restaurantId], [itemId]: { status } },
    }));
    setSaveSuccess(false);
  }, []);

  const removeOverride = useCallback((restaurantId: string, itemId: string) => {
    setOverrides(prev => {
      const copy = { ...prev[restaurantId] };
      delete copy[itemId];
      return { ...prev, [restaurantId]: copy };
    });
    setSaveSuccess(false);
  }, []);

  // ── Single mode helpers ──

  const updateSingleItem = useCallback((itemId: string, patch: Partial<ItemState>) => {
    if (editMode === "all") return;
    setAllStates(prev => ({
      ...prev,
      [editMode]: { ...prev[editMode], [itemId]: { ...prev[editMode]?.[itemId], ...patch } },
    }));
    setSaveSuccess(false);
  }, [editMode]);

  const toggleSingleSizeColor = useCallback((itemId: string, field: "available_sizes" | "available_colors" | "available_units", value: string, allValues: string[]) => {
    if (editMode === "all") return;
    setAllStates(prev => {
      const current = prev[editMode]?.[itemId];
      if (!current) return prev;
      const selected = current[field] === null ? new Set(allValues) : new Set(current[field]!.split(",").filter(Boolean));
      if (selected.has(value)) selected.delete(value); else selected.add(value);
      return { ...prev, [editMode]: { ...prev[editMode], [itemId]: { ...current, [field]: selected.size === allValues.length ? null : Array.from(selected).join(",") } } };
    });
  }, [editMode]);

  // ── Save ──

  function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);
    startSaving(async () => {
      try {
        if (editMode === "all") {
          // Save all restaurants: base + overrides
          for (const r of restaurants) {
            const itemPayload = items.map(item => {
              const base = baseStates[item.id] ?? DEFAULT_STATE;
              const override = overrides[r.id]?.[item.id];
              const merged = override ? { ...base, ...override } : base;
              return {
                item_id: item.id,
                status: merged.status,
                limited_qty: merged.status === "limited" && merged.limited_qty !== "" ? Number(merged.limited_qty) : null,
                cycle_notes: merged.cycle_notes || null,
                available_sizes: merged.available_sizes || null,
                available_colors: merged.available_colors || null,
                available_units: merged.available_units || null,
              };
            });
            const res = await fetch("/api/availability", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restaurant_id: r.id, delivery_date: date, items: itemPayload }),
            });
            if (!res.ok) throw new Error(`Failed for ${r.name}`);
          }
        } else {
          // Save single restaurant
          const state = allStates[editMode] ?? {};
          const res = await fetch("/api/availability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurant_id: editMode,
              delivery_date: date,
              items: Object.entries(state).map(([item_id, s]) => ({
                item_id,
                status: s.status,
                limited_qty: s.status === "limited" && s.limited_qty !== "" ? Number(s.limited_qty) : null,
                cycle_notes: s.cycle_notes || null,
                available_sizes: s.available_sizes || null,
                available_colors: s.available_colors || null,
                available_units: s.available_units || null,
              })),
            }),
          });
          if (!res.ok) throw new Error("Failed to save");
        }
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch {
        setSaveError("Save failed. Please try again.");
      }
    });
  }

  function handleDuplicate() {
    startDuplicating(async () => {
      try {
        if (editMode === "all") {
          // Duplicate for all restaurants
          for (const r of restaurants) {
            await fetch("/api/availability/duplicate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restaurant_id: r.id, target_date: date }),
            });
          }
        } else {
          await fetch("/api/availability/duplicate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ restaurant_id: editMode, target_date: date }),
          });
        }
        window.location.reload();
      } catch {
        setSaveError("Duplicate failed.");
      }
    });
  }

  function markAllBase(status: AvailabilityStatus) {
    if (editMode === "all") {
      setBaseStates(prev => {
        const updated: ItemStates = {};
        for (const [id, s] of Object.entries(prev)) updated[id] = { ...s, status };
        return updated;
      });
    } else {
      setAllStates(prev => {
        const updated: ItemStates = {};
        for (const [id, s] of Object.entries(prev[editMode] ?? {})) updated[id] = { ...s, status };
        return { ...prev, [editMode]: updated };
      });
    }
  }

  // ── Rendering ──

  const itemsByCategory: Partial<Record<ItemCategory, Item[]>> = {};
  for (const item of filteredItems) {
    if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
    itemsByCategory[item.category]!.push(item);
  }

  const isAllMode = editMode === "all";
  const singleState = !isAllMode ? (allStates[editMode] ?? {}) : {};

  // Short restaurant names for pills
  const shortName = (name: string) => {
    if (name.toLowerCase().includes("under")) return "US";
    if (name.toLowerCase().includes("event")) return "Ev";
    return name.slice(0, 2);
  };

  return (
    <div>
      {/* Mode selector */}
      <div className="bg-white border-b border-farm-dark/10 sticky top-0 z-10">
        <div className="flex">
          <button type="button" onClick={() => setEditMode("all")}
            className={`flex-1 py-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
              isAllMode ? "border-farm-green text-farm-green" : "border-transparent text-farm-muted"
            }`}
          >
            All Restaurants
          </button>
          {restaurants.map(r => (
            <button key={r.id} type="button" onClick={() => setEditMode(r.id)}
              className={`flex-1 py-3 px-2 text-sm font-semibold border-b-2 transition-colors ${
                editMode === r.id ? "border-farm-green text-farm-green" : "border-transparent text-farm-muted"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {/* Search */}
      <div className="bg-white border-b border-farm-dark/10 px-4 py-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-farm-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 min-h-[44px] text-sm border border-farm-dark/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-farm-muted hover:text-farm-muted/90"
              aria-label="Clear search"
            >✕</button>
          )}
        </div>
        {isSearching && (
          <p className="text-xs text-farm-muted mt-1.5 px-1">
            {filteredItems.length} match{filteredItems.length !== 1 ? "es" : ""}
          </p>
        )}
      </div>

      {/* Bulk actions */}
      <div className="px-4 py-3 bg-farm-cream/40 border-b border-farm-dark/10 flex gap-2">
        <button type="button" onClick={() => markAllBase("available")}
          className="flex-1 py-2 rounded-lg bg-farm-green-light text-farm-green text-xs font-semibold"
        >Mark All Available</button>
        <button type="button" onClick={() => markAllBase("unavailable")}
          className="flex-1 py-2 rounded-lg bg-gray-200 text-farm-dark/80 text-xs font-semibold"
        >Mark All Unavailable</button>
      </div>

      {/* Item list */}
      <div className="pb-4">
        {CATEGORY_ORDER.map(category => {
          const catItems = itemsByCategory[category];
          if (!catItems?.length) return null;

          return (
            <div key={category}>
              <div className="px-4 py-2 bg-farm-cream/60 border-b border-farm-dark/10">
                <h3 className="text-xs font-bold uppercase tracking-wider text-farm-muted">
                  {CATEGORY_LABELS[category]}
                </h3>
              </div>
              <div className="divide-y divide-farm-dark/5">
                {catItems.map(item => {
                  const state = isAllMode
                    ? (baseStates[item.id] ?? DEFAULT_STATE)
                    : (singleState[item.id] ?? DEFAULT_STATE);

                  const itemOverrides = isAllMode
                    ? restaurants.filter(r => overrides[r.id]?.[item.id]).map(r => ({
                        restaurant: r,
                        override: overrides[r.id][item.id],
                      }))
                    : [];

                  const updateFn = isAllMode ? updateBase : updateSingleItem;
                  const toggleFn = isAllMode ? toggleBaseSizeColor : toggleSingleSizeColor;

                  return (
                    <div key={item.id} className="px-4 py-3 bg-white">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-farm-dark truncate">{item.name}</p>
                          {(() => {
                            const allUnits = parseUnits(item.unit_type);
                            return (
                              <p className="text-xs text-farm-muted">
                                {allUnits.map(u => UNIT_LABELS[u] ?? u.toUpperCase()).join(" · ") || "—"}
                              </p>
                            );
                          })()}

                          {/* Units (only if item has multiple unit types) */}
                          {(() => {
                            const allUnits = parseUnits(item.unit_type);
                            if (allUnits.length < 2) return null;
                            const sel = state.available_units === null
                              ? new Set(allUnits)
                              : new Set(state.available_units?.split(",").filter(Boolean) ?? []);
                            return (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="text-[9px] text-farm-muted">Units:</span>
                                {allUnits.map(u => {
                                  const label = UNIT_LABELS[u] ?? u.toUpperCase();
                                  return (
                                    <button key={u} type="button" onClick={() => toggleFn(item.id, "available_units", u, allUnits)}
                                      className={`text-[9px] px-1.5 py-0.5 rounded min-h-0 min-w-0 transition-colors ${sel.has(u) ? "bg-blue-600 text-white" : "bg-farm-cream/60 text-farm-muted line-through"}`}
                                      title={label}
                                    >{label}</button>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          {/* Sizes */}
                          {(item as any).size && (() => {
                            const allSizes = ((item as any).size as string).split(", ").filter(Boolean);
                            const sel = state.available_sizes === null ? new Set(allSizes) : new Set(state.available_sizes?.split(",").filter(Boolean) ?? []);
                            return (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="text-[9px] text-farm-muted">Sizes:</span>
                                {allSizes.map(s => (
                                  <button key={s} type="button" onClick={() => toggleFn(item.id, "available_sizes", s, allSizes)}
                                    className={`text-[9px] px-1.5 py-0.5 rounded min-h-0 min-w-0 transition-colors ${sel.has(s) ? "bg-farm-green text-white" : "bg-farm-cream/60 text-farm-muted line-through"}`}
                                  >{s}</button>
                                ))}
                              </div>
                            );
                          })()}

                          {/* Colors */}
                          {(item as any).color && (() => {
                            const allColors = ((item as any).color as string).split(", ").filter(Boolean);
                            const sel = state.available_colors === null ? new Set(allColors) : new Set(state.available_colors?.split(",").filter(Boolean) ?? []);
                            return (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="text-[9px] text-farm-muted">Colors:</span>
                                {allColors.map(c => (
                                  <button key={c} type="button" onClick={() => toggleFn(item.id, "available_colors", c, allColors)}
                                    className={`text-[9px] px-1.5 py-0.5 rounded min-h-0 min-w-0 transition-colors ${sel.has(c) ? "bg-pf-master-violet text-white" : "bg-farm-cream/60 text-farm-muted line-through"}`}
                                  >{c}</button>
                                ))}
                              </div>
                            );
                          })()}

                          {/* Overrides (all mode only) */}
                          {isAllMode && itemOverrides.length > 0 && (
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {itemOverrides.map(({ restaurant: r, override: ov }) => (
                                <span key={r.id} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${STATUS_PILL[ov.status ?? "unavailable"]}`}>
                                  {shortName(r.name)}: {STATUS_LABELS[ov.status ?? "unavailable"]}
                                  <button type="button" onClick={() => removeOverride(r.id, item.id)}
                                    className="text-current opacity-60 hover:opacity-100 min-h-0 min-w-0 ml-0.5"
                                  >✕</button>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Add override button (all mode only) */}
                          {isAllMode && itemOverrides.length < restaurants.length && (
                            <OverrideAdder
                              restaurants={restaurants.filter(r => !overrides[r.id]?.[item.id])}
                              shortName={shortName}
                              onAdd={(rId, status) => addOverride(rId, item.id, status)}
                            />
                          )}
                        </div>

                        <StatusToggle value={state.status} onChange={v => updateFn(item.id, { status: v })} />
                      </div>

                      {/* Limited qty + notes */}
                      {(state.status === "limited" || state.cycle_notes) && (
                        <div className="mt-2 flex gap-2">
                          {state.status === "limited" && (
                            <input type="number" min="0" placeholder="Qty" value={state.limited_qty}
                              onChange={e => updateFn(item.id, { limited_qty: e.target.value })}
                              className="w-20 px-2 py-1.5 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                            />
                          )}
                          <input type="text" placeholder="Notes (optional)" value={state.cycle_notes}
                            onChange={e => updateFn(item.id, { cycle_notes: e.target.value })}
                            className="flex-1 px-2 py-1.5 text-sm border border-farm-dark/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-farm-green bg-farm-cream/40 placeholder:text-farm-muted"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky bottom */}
      <div className="sticky bottom-nav-safe bg-white border-t border-farm-dark/10 px-4 py-3 space-y-2">
        {saveError && <p className="text-xs text-red-600 text-center">{saveError}</p>}
        {saveSuccess && <p className="text-xs text-farm-green text-center font-medium">Saved to {isAllMode ? "all restaurants" : "1 restaurant"}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={handleDuplicate} disabled={isDuplicating}
            className="flex-1 py-3 rounded-xl border border-farm-dark/15 text-sm font-semibold text-farm-dark/80 bg-white disabled:opacity-50"
          >{isDuplicating ? "Duplicating…" : "Duplicate Last"}</button>
          <button type="button" onClick={handleSave} disabled={isSaving}
            className="btn-primary flex-1 py-3 text-sm font-semibold disabled:opacity-50"
          >{isSaving ? "Saving…" : isAllMode ? "Save All Restaurants" : "Save & Publish"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Override adder inline component ──

function OverrideAdder({
  restaurants,
  shortName,
  onAdd,
}: {
  restaurants: Restaurant[];
  shortName: (name: string) => string;
  onAdd: (restaurantId: string, status: AvailabilityStatus) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="text-[10px] text-farm-muted hover:text-farm-green mt-1 min-h-0 min-w-0"
      >+ exception</button>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {restaurants.map(r => (
        <div key={r.id} className="inline-flex items-center gap-0.5 bg-farm-cream/40 rounded-full px-1 py-0.5">
          <span className="text-[9px] text-farm-muted px-1">{shortName(r.name)}:</span>
          {(["available", "limited", "unavailable"] as AvailabilityStatus[]).map(s => (
            <button key={s} type="button"
              onClick={() => { onAdd(r.id, s); setOpen(false); }}
              className={`text-[9px] px-1.5 py-0.5 rounded-full min-h-0 min-w-0 ${STATUS_PILL[s]}`}
            >{s === "available" ? "✓" : s === "limited" ? "⚠" : "✗"}</button>
          ))}
        </div>
      ))}
      <button type="button" onClick={() => setOpen(false)} className="text-[9px] text-farm-muted min-h-0 min-w-0">cancel</button>
    </div>
  );
}
