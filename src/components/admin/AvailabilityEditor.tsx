"use client";

import { useState, useTransition, useCallback, useMemo, useEffect, useRef } from "react";
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

/** Item-level state shared across restaurants — sizes/colors/units/limits/notes. */
interface SharedItemState {
  limited_qty: string;
  cycle_notes: string;
  available_sizes: string | null;
  available_colors: string | null;
  available_units: string | null;
}

/** Per-restaurant per-item state — just the status. */
type StatusMap = Record<string /*itemId*/, AvailabilityStatus>;
type RestaurantStatuses = Record<string /*restaurantId*/, StatusMap>;

type SharedStates = Record<string /*itemId*/, SharedItemState>;

interface AvailabilityEditorProps {
  items: Item[];
  availability: AvailabilityItem[];
  date: string;
  restaurants: Restaurant[];
}

const DEFAULT_SHARED: SharedItemState = {
  limited_qty: "",
  cycle_notes: "",
  available_sizes: null,
  available_colors: null,
  available_units: null,
};

// ============================================
// Helpers
// ============================================

/** Short two-letter label for a restaurant tab chip. */
function shortName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("under")) return "US";
  if (lower.includes("bar")) return "PB";
  if (lower.includes("event")) return "EV";
  if (lower.includes("press")) return "PR";
  return name.slice(0, 2).toUpperCase();
}

const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: "Available",
  limited: "Limited",
  unavailable: "Unavailable",
};

const STATUS_ICON: Record<AvailabilityStatus, string> = {
  available: "✓",
  limited: "⚠",
  unavailable: "✗",
};

/** Cycle to the next status — Available → Limited → Unavailable → Available. */
function nextStatus(s: AvailabilityStatus): AvailabilityStatus {
  if (s === "available") return "limited";
  if (s === "limited") return "unavailable";
  return "available";
}

/** Tailwind classes for a status chip. */
function chipClasses(status: AvailabilityStatus): string {
  if (status === "available") return "bg-farm-green text-white border-farm-green";
  if (status === "limited") return "bg-amber-500 text-white border-amber-500";
  return "bg-gray-100 text-farm-muted border-gray-200";
}

// ============================================
// Main component
// ============================================

export function AvailabilityEditor({ items, availability, date, restaurants }: AvailabilityEditorProps) {
  // Stable canonical restaurant ordering — Press first if present.
  const orderedRestaurants = useMemo(() => {
    const press = restaurants.find((r) => r.name.toLowerCase() === "press");
    const others = restaurants.filter((r) => r !== press);
    return press ? [press, ...others] : [...restaurants];
  }, [restaurants]);

  const pressId = orderedRestaurants[0]?.id;

  // Build initial state: each restaurant loads its OWN saved status, so
  // per-restaurant chip edits survive a reload instead of being clobbered by
  // a copy of Press's state on the next save. (The original 2026-05-16
  // "copy Press to all" seeding predates the per-restaurant chips.) Press
  // remains the fallback only where a restaurant has no row yet — e.g. an
  // item published to Press before the other restaurants existed.
  const initialStatuses: RestaurantStatuses = useMemo(() => {
    const byRestaurantItem: Record<string, Record<string, AvailabilityItem>> = {};
    for (const a of availability) {
      (byRestaurantItem[a.restaurant_id] ??= {})[a.item_id] = a;
    }
    const pressByItem = byRestaurantItem[pressId ?? ""] ?? {};
    const result: RestaurantStatuses = {};
    for (const r of orderedRestaurants) {
      const own = byRestaurantItem[r.id] ?? {};
      const map: StatusMap = {};
      for (const item of items) {
        map[item.id] =
          ((own[item.id] ?? pressByItem[item.id])?.status as AvailabilityStatus) ?? "unavailable";
      }
      result[r.id] = map;
    }
    return result;
  }, [items, availability, orderedRestaurants, pressId]);

  // Shared (cross-restaurant) fields seed from the Press row, falling back to
  // any restaurant's row so an item saved without a Press row doesn't lose its
  // sizes/colors/units/qty/notes on reload.
  const initialShared: SharedStates = useMemo(() => {
    const pressByItem: Record<string, AvailabilityItem> = {};
    const anyByItem: Record<string, AvailabilityItem> = {};
    for (const a of availability) {
      if (a.restaurant_id === pressId) pressByItem[a.item_id] = a;
      anyByItem[a.item_id] ??= a;
    }
    const result: SharedStates = {};
    for (const item of items) {
      const e = pressByItem[item.id] ?? anyByItem[item.id];
      result[item.id] = {
        limited_qty: e?.limited_qty != null ? String(e.limited_qty) : "",
        cycle_notes: e?.cycle_notes ?? "",
        available_sizes: (e as any)?.available_sizes ?? null,
        available_colors: (e as any)?.available_colors ?? null,
        available_units: (e as any)?.available_units ?? null,
      };
    }
    return result;
  }, [items, availability, pressId]);

  const [statuses, setStatuses] = useState<RestaurantStatuses>(initialStatuses);
  const [shared, setShared] = useState<SharedStates>(initialShared);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isDuplicating, startDuplicating] = useTransition();
  const [search, setSearch] = useState("");

  // ── Restaurant + status filter ──
  // Two independent dimensions. filterRestaurantId === null means "All restaurants"
  // (no restaurant constraint); filterStatus === "any" means no status constraint.
  // With "All" + a status, an item matches if ANY restaurant has that status.
  const [filterRestaurantId, setFilterRestaurantId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<AvailabilityStatus | "any">("any");

  // Always-current statuses, read inside the snapshot effect WITHOUT being a
  // reactive dependency — so editing a chip while filtered doesn't re-run it.
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  // Snapshot of item IDs matching the active filter. null = no narrowing. Recomputed
  // only when the filter *selection* changes (not on every status edit), so rows
  // don't vanish out from under you while you cycle a chip through its states.
  const [matchedIds, setMatchedIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (filterStatus === "any") {
      setMatchedIds(null);
      return;
    }
    const snap = statusesRef.current;
    const ids = new Set<string>();
    if (filterRestaurantId === null) {
      // "All restaurants": match if ANY restaurant has this status.
      for (const item of items) {
        for (const r of orderedRestaurants) {
          if ((snap[r.id]?.[item.id] ?? "unavailable") === filterStatus) {
            ids.add(item.id);
            break;
          }
        }
      }
    } else {
      const map = snap[filterRestaurantId] ?? {};
      for (const item of items) {
        if ((map[item.id] ?? "unavailable") === filterStatus) ids.add(item.id);
      }
    }
    setMatchedIds(ids);
  }, [filterRestaurantId, filterStatus, items, orderedRestaurants]);

  // Picking a restaurant with no status lens chosen yet defaults to "Available"
  // (the common "what did I turn on" view); otherwise the current status lens is
  // kept. "All" leaves the status lens untouched, so "All + Limited" (everything
  // limited anywhere) stays reachable.
  const selectRestaurant = useCallback((id: string | null) => {
    setFilterRestaurantId(id);
    if (id !== null) setFilterStatus((s) => (s === "any" ? "available" : s));
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilterRestaurantId(null);
    setFilterStatus("any");
  }, []);

  const restaurantSelected = filterRestaurantId !== null;
  const statusActive = filterStatus !== "any";
  const filterRestaurantName =
    orderedRestaurants.find((r) => r.id === filterRestaurantId)?.name ?? "";

  const q = search.trim().toLowerCase();
  const filteredItems = items.filter((i) => {
    if (matchedIds !== null && !matchedIds.has(i.id)) return false;
    if (q && !i.name.toLowerCase().includes(q)) return false;
    return true;
  });
  const isSearching = q.length > 0;
  const isNarrowed = isSearching || statusActive || restaurantSelected;

  // ── State updates ──

  const setStatusForRestaurant = useCallback(
    (restaurantId: string, itemId: string, status: AvailabilityStatus) => {
      setStatuses((prev) => ({
        ...prev,
        [restaurantId]: { ...prev[restaurantId], [itemId]: status },
      }));
      setSaveSuccess(false);
    },
    [],
  );

  const setStatusForAll = useCallback(
    (itemId: string, status: AvailabilityStatus) => {
      setStatuses((prev) => {
        const next: RestaurantStatuses = {};
        for (const [rid, map] of Object.entries(prev)) {
          next[rid] = { ...map, [itemId]: status };
        }
        return next;
      });
      setSaveSuccess(false);
    },
    [],
  );

  const updateShared = useCallback((itemId: string, patch: Partial<SharedItemState>) => {
    setShared((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ...patch } }));
    setSaveSuccess(false);
  }, []);

  const toggleSharedMulti = useCallback(
    (
      itemId: string,
      field: "available_sizes" | "available_colors" | "available_units",
      value: string,
      allValues: string[],
    ) => {
      setShared((prev) => {
        const current = prev[itemId] ?? DEFAULT_SHARED;
        const selected =
          current[field] === null
            ? new Set(allValues)
            : new Set(current[field]!.split(",").filter(Boolean));
        if (selected.has(value)) selected.delete(value);
        else selected.add(value);
        const newVal = selected.size === allValues.length ? null : Array.from(selected).join(",");
        return { ...prev, [itemId]: { ...current, [field]: newVal } };
      });
      setSaveSuccess(false);
    },
    [],
  );

  // Bulk-set status for the items currently shown by the filter/search. Scope:
  // when a restaurant is selected, only that restaurant changes; otherwise all
  // restaurants change (always limited to the shown items).
  function bulkSetStatus(status: AvailabilityStatus) {
    const shownIds = filteredItems.map((i) => i.id);
    const targetRestaurantIds =
      filterRestaurantId !== null
        ? [filterRestaurantId]
        : orderedRestaurants.map((r) => r.id);
    setStatuses((prev) => {
      const next: RestaurantStatuses = { ...prev };
      for (const rid of targetRestaurantIds) {
        const updated: StatusMap = { ...(prev[rid] ?? {}) };
        for (const id of shownIds) updated[id] = status;
        next[rid] = updated;
      }
      return next;
    });
    setSaveSuccess(false);
  }

  // ── Save ──

  function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);
    startSaving(async () => {
      try {
        const failures: string[] = [];
        await Promise.all(
          orderedRestaurants.map(async (r) => {
            const statusMap = statuses[r.id] ?? {};
            const payload = items.map((item) => {
              const status = statusMap[item.id] ?? "unavailable";
              const s = shared[item.id] ?? DEFAULT_SHARED;
              return {
                item_id: item.id,
                status,
                limited_qty:
                  status === "limited" && s.limited_qty !== "" ? Number(s.limited_qty) : null,
                cycle_notes: s.cycle_notes || null,
                // null = "all varieties available" (default); "" = "none — item
                // is orderable but exposes no size/color choice". Preserve "" so
                // deselect-all sticks instead of silently reverting to all.
                available_sizes: s.available_sizes ?? null,
                available_colors: s.available_colors ?? null,
                // Units must always have ≥1 option (it's the container you order
                // in), so deselect-all-units falls back to the item's full list.
                available_units: s.available_units || null,
              };
            });
            const res = await fetch("/api/availability", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restaurant_id: r.id, delivery_date: date, items: payload }),
            });
            if (!res.ok) failures.push(r.name);
          }),
        );
        if (failures.length > 0) {
          setSaveError(`Save failed for: ${failures.join(", ")}`);
          return;
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
        await Promise.all(
          orderedRestaurants.map((r) =>
            fetch("/api/availability/duplicate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ restaurant_id: r.id, target_date: date }),
            }),
          ),
        );
        window.location.reload();
      } catch {
        setSaveError("Duplicate failed.");
      }
    });
  }

  // ── Rendering ──

  const itemsByCategory: Partial<Record<ItemCategory, Item[]>> = {};
  for (const item of filteredItems) {
    const cat = item.category as ItemCategory;
    if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
    itemsByCategory[cat]!.push(item);
  }

  return (
    <div>
      {/* Search */}
      <div className="bg-white border-b border-farm-dark/10 px-4 py-3 sticky top-0 z-10">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-farm-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="search"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 min-h-[44px] text-sm border border-farm-dark/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-farm-muted hover:text-farm-muted/90"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {/* Filter: pick a restaurant, then optionally narrow by that restaurant's status */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => selectRestaurant(null)}
            aria-pressed={!restaurantSelected}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors min-h-[40px] ${
              !restaurantSelected
                ? "bg-farm-dark text-white border-farm-dark"
                : "bg-white text-farm-dark/70 border-farm-dark/15"
            }`}
          >
            All
          </button>
          {orderedRestaurants.map((r) => {
            const active = filterRestaurantId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => selectRestaurant(r.id)}
                aria-pressed={active}
                className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-colors min-h-[40px] ${
                  active
                    ? "bg-farm-green text-white border-farm-green"
                    : "bg-white text-farm-dark/70 border-farm-dark/15"
                }`}
              >
                {r.name}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-farm-muted mr-0.5">
            Status
          </span>
          {(["any", "available", "limited", "unavailable"] as const).map((st) => {
            const active = filterStatus === st;
            let activeCls = "bg-farm-dark text-white border-farm-dark";
            if (st === "available") activeCls = "bg-farm-green text-white border-farm-green";
            else if (st === "limited") activeCls = "bg-amber-500 text-white border-amber-500";
            else if (st === "unavailable") activeCls = "bg-gray-500 text-white border-gray-500";
            return (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                aria-pressed={active}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold border transition-colors min-h-[34px] ${
                  active ? activeCls : "bg-white text-farm-dark/70 border-farm-dark/15"
                }`}
              >
                {st === "any" ? "Any" : `${STATUS_ICON[st]} ${STATUS_LABELS[st]}`}
              </button>
            );
          })}
        </div>

        {isNarrowed && (
          <div className="mt-2 flex items-center justify-between px-1">
            <p className="text-xs text-farm-muted">
              {filteredItems.length} of {items.length}
              {restaurantSelected
                ? ` · ${filterRestaurantName}`
                : statusActive
                  ? " · Any restaurant"
                  : ""}
              {statusActive && ` · ${STATUS_LABELS[filterStatus]}`}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-farm-green"
            >
              Clear
            </button>
          </div>
        )}

        <p className="text-[11px] text-farm-muted mt-2 leading-snug">
          Tap a restaurant chip to cycle <span className="font-semibold text-farm-green">✓ Available</span>
          {" → "}
          <span className="font-semibold text-amber-600">⚠ Limited</span>
          {" → "}
          <span className="font-semibold">✗ Unavailable</span>. Tap the row label to set all 4 at once.
        </p>
      </div>

      {/* Bulk actions — scoped to the shown items (and the selected restaurant, if any) */}
      <div className="px-4 py-3 bg-farm-cream/40 border-b border-farm-dark/10">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => bulkSetStatus("available")}
            className="flex-1 py-2 rounded-lg bg-farm-green-light text-farm-green text-xs font-semibold"
          >
            Mark {isNarrowed ? "Shown" : "All"} Available
          </button>
          <button
            type="button"
            onClick={() => bulkSetStatus("unavailable")}
            className="flex-1 py-2 rounded-lg bg-gray-200 text-farm-dark/80 text-xs font-semibold"
          >
            Mark {isNarrowed ? "Shown" : "All"} Unavailable
          </button>
        </div>
        {isNarrowed && (
          <p className="text-[10px] text-farm-muted mt-1.5 px-0.5">
            Affects the {filteredItems.length} shown item{filteredItems.length !== 1 ? "s" : ""}
            {restaurantSelected ? ` · ${filterRestaurantName} only` : " · all restaurants"}.
          </p>
        )}
      </div>

      {/* Item list */}
      <div className="pb-4">
        {filteredItems.length === 0 && (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-farm-muted">No items match this filter.</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 text-sm font-medium text-farm-green"
            >
              Clear filters
            </button>
          </div>
        )}
        {CATEGORY_ORDER.map((category) => {
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
                {catItems.map((item) => {
                  const sharedState = shared[item.id] ?? DEFAULT_SHARED;
                  const allUnits = parseUnits(item.unit_type);
                  const hasMultiUnits = allUnits.length >= 2;
                  const sizesList = (item as any).size
                    ? ((item as any).size as string).split(", ").filter(Boolean)
                    : [];
                  const colorsList = (item as any).color
                    ? ((item as any).color as string).split(", ").filter(Boolean)
                    : [];

                  // Status across restaurants for the "Set all" cycler — picks the
                  // first restaurant's status as the indicator.
                  const indicatorStatus =
                    statuses[orderedRestaurants[0]?.id]?.[item.id] ?? "unavailable";

                  return (
                    <div key={item.id} className="px-4 py-3 bg-white">
                      <div className="flex items-start gap-3">
                        {/* Left: name + metadata + per-restaurant chips */}
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => setStatusForAll(item.id, nextStatus(indicatorStatus))}
                            className="text-left w-full group"
                            title="Tap to set all 4 restaurants"
                          >
                            <p className="text-sm font-medium text-farm-dark truncate group-hover:underline decoration-dotted">
                              {item.name}
                            </p>
                          </button>
                          <p className="text-xs text-farm-muted">
                            {allUnits.map((u) => UNIT_LABELS[u] ?? u.toUpperCase()).join(" · ") || "—"}
                          </p>

                          {/* Per-restaurant status chips */}
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {orderedRestaurants.map((r) => {
                              const status = statuses[r.id]?.[item.id] ?? "unavailable";
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() =>
                                    setStatusForRestaurant(r.id, item.id, nextStatus(status))
                                  }
                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors min-h-[28px] ${chipClasses(status)}`}
                                  aria-label={`${r.name}: ${STATUS_LABELS[status]}`}
                                  title={`${r.name}: ${STATUS_LABELS[status]}`}
                                >
                                  <span className="text-[10px] opacity-80">{shortName(r.name)}</span>
                                  <span>{STATUS_ICON[status]}</span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Units selector (shared across restaurants) */}
                          {hasMultiUnits && (
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              <span className="text-[9px] text-farm-muted">Units:</span>
                              {(() => {
                                const sel =
                                  sharedState.available_units === null
                                    ? new Set(allUnits)
                                    : new Set(
                                        sharedState.available_units?.split(",").filter(Boolean) ?? [],
                                      );
                                return allUnits.map((u) => {
                                  const label = UNIT_LABELS[u] ?? u.toUpperCase();
                                  return (
                                    <button
                                      key={u}
                                      type="button"
                                      onClick={() =>
                                        toggleSharedMulti(item.id, "available_units", u, allUnits)
                                      }
                                      className={`text-[9px] px-1.5 py-0.5 rounded min-h-0 min-w-0 transition-colors ${
                                        sel.has(u)
                                          ? "bg-blue-600 text-white"
                                          : "bg-farm-cream/60 text-farm-muted line-through"
                                      }`}
                                      title={label}
                                    >
                                      {label}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          )}

                          {/* Sizes selector. Empty selection (all line-through) is a
                              real state — "none, ordered plain" — distinct from the
                              default (null → all selected). */}
                          {sizesList.length > 0 && (() => {
                            const sel =
                              sharedState.available_sizes === null
                                ? new Set(sizesList)
                                : new Set(
                                    sharedState.available_sizes?.split(",").filter(Boolean) ?? [],
                                  );
                            return (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="text-[9px] text-farm-muted">
                                  Sizes{sel.size === 0 ? " (none — ordered plain)" : ""}:
                                </span>
                                {sizesList.map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() =>
                                      toggleSharedMulti(item.id, "available_sizes", s, sizesList)
                                    }
                                    className={`text-[9px] px-1.5 py-0.5 rounded min-h-0 min-w-0 transition-colors ${
                                      sel.has(s)
                                        ? "bg-farm-green text-white"
                                        : "bg-farm-cream/60 text-farm-muted line-through"
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}

                          {/* Colors selector. Empty selection (all line-through) is a
                              real state — "none, ordered plain" — distinct from the
                              default (null → all selected). */}
                          {colorsList.length > 0 && (() => {
                            const sel =
                              sharedState.available_colors === null
                                ? new Set(colorsList)
                                : new Set(
                                    sharedState.available_colors?.split(",").filter(Boolean) ?? [],
                                  );
                            return (
                              <div className="flex items-center gap-1 mt-1 flex-wrap">
                                <span className="text-[9px] text-farm-muted">
                                  Colors{sel.size === 0 ? " (none — ordered plain)" : ""}:
                                </span>
                                {colorsList.map((c) => (
                                  <button
                                    key={c}
                                    type="button"
                                    onClick={() =>
                                      toggleSharedMulti(item.id, "available_colors", c, colorsList)
                                    }
                                    className={`text-[9px] px-1.5 py-0.5 rounded min-h-0 min-w-0 transition-colors ${
                                      sel.has(c)
                                        ? "bg-pf-master-violet text-white"
                                        : "bg-farm-cream/60 text-farm-muted line-through"
                                    }`}
                                  >
                                    {c}
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Limited qty + notes (shared across restaurants).
                          Shown when any restaurant is "limited" or there's a note. */}
                      {(orderedRestaurants.some((r) => statuses[r.id]?.[item.id] === "limited") ||
                        sharedState.cycle_notes) && (
                        <div className="mt-2 flex gap-2">
                          {orderedRestaurants.some((r) => statuses[r.id]?.[item.id] === "limited") && (
                            <input
                              type="number"
                              min="0"
                              placeholder="Qty"
                              value={sharedState.limited_qty}
                              onChange={(e) => updateShared(item.id, { limited_qty: e.target.value })}
                              className="w-20 px-2 py-1.5 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-amber-50"
                            />
                          )}
                          <input
                            type="text"
                            placeholder="Notes (optional)"
                            value={sharedState.cycle_notes}
                            onChange={(e) => updateShared(item.id, { cycle_notes: e.target.value })}
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
        {saveSuccess && (
          <p className="text-xs text-farm-green text-center font-medium">
            Saved to all {orderedRestaurants.length} restaurants
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={isDuplicating}
            className="flex-1 py-3 rounded-xl border border-farm-dark/15 text-sm font-semibold text-farm-dark/80 bg-white disabled:opacity-50"
          >
            {isDuplicating ? "Duplicating…" : "Duplicate Last"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex-1 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save All Restaurants"}
          </button>
        </div>
      </div>
    </div>
  );
}
