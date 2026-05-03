"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_ORDER, MAX_NOTES_LENGTH, UNIT_LABELS } from "@/lib/constants";
import { priceForUnit } from "@/lib/utils";
import { CategorySection } from "./category-section";
import { OnboardingTour } from "./OnboardingTour";
import { ChefSuggestionBox } from "./ChefSuggestionBox";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";
import type { UnitType } from "@/types/database";

/** Resolve which units this availability row exposes to the chef. */
function resolveUnits(item: { unit_type: string }, availableUnits: string | null | undefined): UnitType[] {
  const itemUnits = String(item.unit_type ?? "")
    .split(",").map(u => u.trim()).filter(Boolean) as UnitType[];
  if (!availableUnits) return itemUnits;
  const allowed = new Set(availableUnits.split(",").map(u => u.trim()).filter(Boolean));
  return itemUnits.filter(u => allowed.has(u));
}

interface OrderFormProps {
  availabilityItems: AvailabilityItemWithItem[];
  restaurantId: string;
  restaurantName: string;
  deliveryDate: string;
  deliveryDateFormatted: string;
  initialQuantities?: Record<string, number>;
  /** Per-(quantity-key) color selections, hydrated when editing an existing order. */
  initialColors?: Record<string, string[]>;
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
    /** Size descriptor when item has sizes ("Quarter", "Palm", ...). null otherwise. */
    sizeLabel: string | null;
    /** Comma-separated colors selected for this line ("red,blue"). null when none. */
    colorKey: string | null;
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
  initialColors = {},
  initialNotes = "",
  editingOrderId,
}: OrderFormProps) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [itemColors, setItemColors] = useState<Record<string, string[]>>(initialColors);
  const [freeformNotes, setFreeformNotes] = useState(initialNotes);
  const [search, setSearch] = useState("");

  // Filter to only available/limited items, then by search query
  const allAvailable = availabilityItems.filter((ai) => ai.status !== "unavailable");
  const visibleItems = search.trim()
    ? allAvailable.filter((ai) => ai.item.name.toLowerCase().includes(search.toLowerCase().trim()))
    : allAvailable;

  // Restaurant-scoped section visibility:
  //   • Press Bar login → only the Press Bar section (no Regular, no Events).
  //   • Press / Under-Study → Regular + Events, Press Bar hidden (those
  //     items go to the bartender, not the kitchen).
  // Match by lowercased name so "Press Bar" / "press bar" / a future
  // capitalization tweak still all route to the same gate.
  const isPressBarChef = restaurantName.trim().toLowerCase() === "press bar";

  // Independent menu visibility — each section asks "is the item flagged
  // for this menu?" with no cross-menu exclusion. An item with all three
  // flags appears in all three sections; an item with only Events flagged
  // shows only in the Events Menu section. The implicit-Regular default
  // is now driven by show_in_regular_menu (column added in migration 030
  // with default true, so existing items behave as before).
  //
  // The DB column may not exist on rows fetched before migration 030 has
  // run; treat undefined/null as true to keep those items in Regular.
  const pressBarItems = isPressBarChef
    ? visibleItems.filter((ai) => (ai.item as any).is_press_bar_item)
    : [];
  const eventItems = isPressBarChef
    ? []
    : visibleItems.filter((ai) => (ai.item as any).is_event_item);
  const regularItems = isPressBarChef
    ? []
    : visibleItems.filter((ai) => (ai.item as any).show_in_regular_menu !== false);

  function groupByCategory(items: AvailabilityItemWithItem[]): Record<ItemCategory, AvailabilityItemWithItem[]> {
    return CATEGORY_ORDER.reduce<Record<ItemCategory, AvailabilityItemWithItem[]>>(
      (acc, cat) => {
        acc[cat] = items.filter((ai) => ai.item.category === cat);
        return acc;
      },
      {} as Record<ItemCategory, AvailabilityItemWithItem[]>,
    );
  }

  const regularByCategory = groupByCategory(regularItems);
  const eventsByCategory = groupByCategory(eventItems);
  const pressBarByCategory = groupByCategory(pressBarItems);

  const isSearching = search.trim().length > 0;

  function handleQuantityChange(key: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [key]: qty }));
  }

  function handleNoteChange(id: string, note: string) {
    setItemNotes((prev) => ({ ...prev, [id]: note }));
  }

  /** Iterate every (unit?, size?) combination an item exposes, yielding its quantity key. */
  function* enumerateKeys(ai: AvailabilityItemWithItem): Generator<{ key: string; unit?: UnitType; size?: string }> {
    const sizes = (ai.item as any).size ? (ai.item as any).size.split(", ").filter(Boolean) : [];
    const units = resolveUnits(ai.item, (ai as any).available_units);
    const hasMultiUnits = units.length > 1;
    const hasSizes = sizes.length > 0;
    if (hasMultiUnits && hasSizes) {
      for (const u of units) for (const s of sizes) yield { key: `${ai.id}__unit:${u}__${s}`, unit: u, size: s };
    } else if (hasMultiUnits) {
      for (const u of units) yield { key: `${ai.id}__unit:${u}`, unit: u };
    } else if (hasSizes) {
      for (const s of sizes) yield { key: `${ai.id}__${s}`, size: s };
    } else {
      yield { key: ai.id };
    }
  }

  // Check if any item has quantity > 0 (across ALL items, not just searched)
  const hasAnyOrdered = allAvailable.some((ai) => {
    for (const { key } of enumerateKeys(ai)) if ((quantities[key] ?? 0) > 0) return true;
    return false;
  });

  // Total order lines with quantity > 0
  const orderedCount = allAvailable.reduce((count, ai) => {
    let n = 0;
    for (const { key } of enumerateKeys(ai)) if ((quantities[key] ?? 0) > 0) n++;
    return count + n;
  }, 0);

  function handleReview() {
    const orderedItems: OrderFormData["items"] = [];

    // Use allAvailable so search doesn't hide ordered items
    for (const ai of allAvailable) {
      const itemNote = itemNotes[ai.id] ?? "";

      for (const { key, unit, size } of enumerateKeys(ai)) {
        const qty = quantities[key] ?? 0;
        if (qty <= 0) continue;

        // Suffix the displayed name with unit + size when present
        const unitLabel = unit ? ((UNIT_LABELS as Record<string, string>)[unit] ?? unit.toUpperCase()) : null;
        const suffixParts = [unitLabel, size].filter(Boolean) as string[];
        const itemName = suffixParts.length > 0 ? `${ai.item.name} (${suffixParts.join(" · ")})` : ai.item.name;

        // Colors live at the same key as the qty
        const colors = itemColors[key] ?? [];
        const colorKey = colors.length > 0 ? colors.join(",") : null;
        // Keep the human-readable color note in itemNote for backwards-compat
        // displays; the structured colorKey field is what receiver/edit
        // hydration round-trips through.
        const colorNote = colors.length > 0 ? `Color: ${colors.join(", ")}` : "";
        const note = [colorNote, itemNote].filter(Boolean).join(" | ");

        // Persist the specific unit chosen (or fall back to whatever's on the item)
        const unitForOrder = unit ?? (String(ai.item.unit_type).split(",")[0]?.trim() || ai.item.unit_type);

        // Resolve per-unit price → fallback to default_price.
        // Frozen at submit time so future price changes don't rewrite history.
        const unitPrice = priceForUnit(ai.item, unitForOrder);

        orderedItems.push({
          availabilityItemId: ai.id,
          itemName,
          unitType: unitForOrder,
          sizeLabel: size ?? null,
          colorKey,
          quantity: qty,
          unitPrice,
          itemNote: note,
        });
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
      {/* PwaInstallPrompt mounts in /history/layout.tsx instead — /order has
          a sticky Review bar that fights the prompt no matter where it's
          anchored, and SKIP_PATHS alone wasn't reliable when the bundle
          was cached by the service worker. */}
      {editingOrderId && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-2">
          <span className="text-xs text-amber-700 font-medium">Editing existing order — changes will replace your previous submission</span>
        </div>
      )}
      {/* Sticky search bar */}
      <div className="sticky top-0 z-30 bg-farm-cream/95 backdrop-blur-sm border-b border-farm-dark/5 px-4 py-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-farm-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 min-h-[44px] text-sm border border-farm-dark/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
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
        {orderedCount > 0 && (
          <p className="text-xs text-farm-green mt-1.5 px-1">
            {orderedCount} item{orderedCount !== 1 ? "s" : ""} in your order
          </p>
        )}
      </div>

      <div className="flex-1 px-4 py-4 pb-32">
        {visibleItems.length === 0 ? (
          <div className="text-center py-12 text-farm-muted text-sm">
            {search ? `No items match "${search}"` : "No items available for this delivery."}
          </div>
        ) : (
          <>
            {/* ── REGULAR MENU ──────────────────────────────────────── */}
            {regularItems.length > 0 && (
              <>
                {(eventItems.length > 0 || pressBarItems.length > 0) && (
                  <div className="flex items-baseline justify-between mt-1 mb-3 px-1">
                    <p className="font-display text-lg text-farm-dark">Regular Menu</p>
                    <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">
                      {regularItems.length} item{regularItems.length === 1 ? "" : "s"}
                    </p>
                  </div>
                )}
                {CATEGORY_ORDER.map((cat) => {
                  const catItems = regularByCategory[cat];
                  if (catItems.length === 0) return null;
                  return (
                    <CategorySection
                      key={`reg-${cat}`}
                      category={cat}
                      items={catItems}
                      quantities={quantities}
                      itemNotes={itemNotes}
                      itemColors={itemColors}
                      onQuantityChange={handleQuantityChange}
                      onNoteChange={handleNoteChange}
                      onColorChange={(key, colors) => setItemColors((prev) => ({ ...prev, [key]: colors }))}
                    />
                  );
                })}
              </>
            )}

            {/* ── EVENTS MENU ───────────────────────────────────────── */}
            {eventItems.length > 0 && (
              <>
                <div className="mt-8 mb-3 pt-5 border-t border-pf-master-violet/20">
                  <div className="flex items-baseline justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-pf-master-violet" aria-hidden="true" />
                      <p className="font-display text-lg text-farm-dark">Events Menu</p>
                    </div>
                    <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">
                      {eventItems.length} item{eventItems.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="text-xs text-farm-muted mt-1.5 px-1 leading-relaxed">
                    Special-occasion items — only order these if you&apos;re hosting an event on this delivery date.
                  </p>
                </div>
                {CATEGORY_ORDER.map((cat) => {
                  const catItems = eventsByCategory[cat];
                  if (catItems.length === 0) return null;
                  return (
                    <CategorySection
                      key={`evt-${cat}`}
                      category={cat}
                      items={catItems}
                      quantities={quantities}
                      itemNotes={itemNotes}
                      itemColors={itemColors}
                      onQuantityChange={handleQuantityChange}
                      onNoteChange={handleNoteChange}
                      onColorChange={(key, colors) => setItemColors((prev) => ({ ...prev, [key]: colors }))}
                    />
                  );
                })}
              </>
            )}

            {/* ── PRESS BAR MENU ────────────────────────────────────── */}
            {pressBarItems.length > 0 && (
              <>
                <div className="mt-8 mb-3 pt-5 border-t border-pf-master-blue/20">
                  <div className="flex items-baseline justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-pf-master-blue" aria-hidden="true" />
                      <p className="font-display text-lg text-farm-dark">Press Bar</p>
                    </div>
                    <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">
                      {pressBarItems.length} item{pressBarItems.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="text-xs text-farm-muted mt-1.5 px-1 leading-relaxed">
                    Cocktail program — drink garnishes, edible flowers for the bar, finishing herbs.
                  </p>
                </div>
                {CATEGORY_ORDER.map((cat) => {
                  const catItems = pressBarByCategory[cat];
                  if (catItems.length === 0) return null;
                  return (
                    <CategorySection
                      key={`bar-${cat}`}
                      category={cat}
                      items={catItems}
                      quantities={quantities}
                      itemNotes={itemNotes}
                      itemColors={itemColors}
                      onQuantityChange={handleQuantityChange}
                      onNoteChange={handleNoteChange}
                      onColorChange={(key, colors) => setItemColors((prev) => ({ ...prev, [key]: colors }))}
                    />
                  );
                })}
              </>
            )}

            {/* General notes */}
            <div className="card px-4 py-4 mt-2">
              <label
                htmlFor="freeform-notes"
                className="block text-sm font-semibold text-farm-dark mb-2"
              >
                Notes for Press Farm
              </label>
              <textarea
                id="freeform-notes"
                value={freeformNotes}
                onChange={(e) => setFreeformNotes(e.target.value)}
                maxLength={MAX_NOTES_LENGTH}
                rows={3}
                placeholder="Any special requests or substitutions..."
                className="w-full text-sm border border-farm-dark/10 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
              />
              <p className="text-xs text-farm-muted mt-1 text-right">
                {freeformNotes.length}/{MAX_NOTES_LENGTH}
              </p>
            </div>

            {/* Chef-facing suggestion box — crop requests + feature ideas */}
            <ChefSuggestionBox />
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
