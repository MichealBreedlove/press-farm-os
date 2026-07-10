"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_ORDER, EVENT_MENU_KEY_PREFIX, MAX_NOTES_LENGTH, UNIT_LABELS } from "@/lib/constants";
import { priceForUnit } from "@/lib/utils";
import { CategorySection } from "./category-section";
import { OnboardingTour } from "./OnboardingTour";
import { ChefSuggestionBox } from "./ChefSuggestionBox";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";
import type { UnitType } from "@/types/database";
import { resolveUnits, resolveSizes, isEventOnlyItem } from "@/lib/order-availability";
import { buildOrderKey, enumerateOrderKeys } from "@/lib/order-keys";

interface OrderFormProps {
  availabilityItems: AvailabilityItemWithItem[];
  restaurantId: string;
  restaurantName: string;
  deliveryDate: string;
  deliveryDateFormatted: string;
  initialQuantities?: Record<string, number>;
  /** Per-(quantity-key) color selections, hydrated when editing an existing order. */
  initialColors?: Record<string, string[]>;
  /** Per-(quantity-key) variety selections, hydrated when editing an existing order. */
  initialVarieties?: Record<string, string[]>;
  /** Per-availability-item "For an event" checkmark, hydrated when editing. */
  initialEventChecked?: Record<string, boolean>;
  /** Items whose regular/event split is open (event-portion quantities live
   *  under EVENT_MENU_KEY_PREFIX keys), hydrated when editing. */
  initialSplitOpen?: Record<string, boolean>;
  initialNotes?: string;
  editingOrderId?: string;
}

/** Which menu a line was placed under. The chef form renders one merged list;
 *  'events' is set by the per-item "For an event" checkmark (automatic for
 *  events-only items) or by the event portion of a split line, and persists
 *  to order_items.menu_section. 'press_bar' lines never collide with the
 *  others, so they persist as NULL (same as 'regular'). */
export type MenuSection = "regular" | "events" | "press_bar";

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
    /** Comma-separated varieties selected for this line ("Genovese,Thai"). null when none. */
    varietyKey: string | null;
    /** Order-form section this line came from. */
    menuSection: MenuSection;
    quantity: number;
    unitPrice: number | null;
    itemNote: string;
  }[];
  freeformNotes: string;
  editingOrderId?: string;
  /** Idempotency token minted when the chef enters review. Reused across
   *  retries of the same submission so a lost-response retry can't double the
   *  order; a fresh Review pass mints a new token (a genuine new submission). */
  idempotencyKey: string;
}

export function OrderForm({
  availabilityItems,
  restaurantId,
  restaurantName,
  deliveryDate,
  deliveryDateFormatted,
  initialQuantities = {},
  initialColors = {},
  initialVarieties = {},
  initialEventChecked = {},
  initialSplitOpen = {},
  initialNotes = "",
  editingOrderId,
}: OrderFormProps) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities);
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [itemColors, setItemColors] = useState<Record<string, string[]>>(initialColors);
  const [itemVarieties, setItemVarieties] = useState<Record<string, string[]>>(initialVarieties);
  const [eventChecked, setEventChecked] = useState<Record<string, boolean>>(initialEventChecked);
  const [splitOpen, setSplitOpen] = useState<Record<string, boolean>>(initialSplitOpen);
  const [freeformNotes, setFreeformNotes] = useState(initialNotes);
  const [search, setSearch] = useState("");

  // Rehydrate from sessionStorage on first mount when not editing — this
  // is what makes "Review Order → Back" preserve quantities. The review
  // page wrote press_farm_order before navigating; if the chef clicks
  // Back, OrderForm remounts fresh from server props and would otherwise
  // wipe the order. Restore it once if the saved snapshot matches this
  // restaurant + delivery date so we don't accidentally cross-contaminate
  // a different in-flight session.
  useEffect(() => {
    if (editingOrderId) return; // edit mode hydrates from order_items via props
    try {
      const raw = typeof window !== "undefined"
        ? sessionStorage.getItem("press_farm_order")
        : null;
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (
        saved?.restaurantId !== restaurantId ||
        saved?.deliveryDate !== deliveryDate
      ) {
        return; // not the same draft — don't restore
      }
      // The saved payload is the format the review page reads — a
      // flattened items[] array. Rebuild the quantity / color maps
      // using the same composite keys the form computes from
      // (availabilityItemId, unit, size).
      const restoredQuantities: Record<string, number> = {};
      const restoredColors: Record<string, string[]> = {};
      const restoredVarieties: Record<string, string[]> = {};
      const restoredEventChecked: Record<string, boolean> = {};
      const restoredSplitOpen: Record<string, boolean> = {};
      // Pre-pass: an item with BOTH regular and events lines was split —
      // its events lines restore under prefixed event-portion keys. An item
      // with ONLY events lines restores as the whole-item checkmark.
      const aiIdsWithRegular = new Set<string>();
      for (const it of saved.items ?? []) {
        if (it.menuSection !== "events") aiIdsWithRegular.add(it.availabilityItemId as string);
      }
      for (const it of saved.items ?? []) {
        const aiId = it.availabilityItemId as string;
        const unit = it.unitType as string | undefined;
        const size = it.sizeLabel as string | null | undefined;
        const ai = availabilityItems.find((a) => a.id === aiId);
        // The saved line references an availability row that's no longer on
        // this form (admin republished between save and restore). Restoring
        // it would park an invisible quantity under a dead key — drop it.
        if (!ai) continue;
        // Match enumerateKeys(): multi-unit is decided from the resolved
        // (availability-overridden) unit list, not the raw item.unit_type,
        // or the restored key won't line up with the keys the form renders.
        const hasMulti = resolveUnits(ai.item, ai.available_units).length > 1;
        let key = buildOrderKey(aiId, { unit, size, hasMultiUnits: hasMulti });
        if (it.menuSection === "events") {
          if (aiIdsWithRegular.has(aiId)) {
            // Split line — event portion lives under the prefixed keys.
            key = `${EVENT_MENU_KEY_PREFIX}${key}`;
            restoredSplitOpen[aiId] = true;
          } else {
            // Whole item was for the event — restore as the checkmark.
            restoredEventChecked[aiId] = true;
          }
        }
        restoredQuantities[key] = (restoredQuantities[key] ?? 0) + Number(it.quantity ?? 0);
        if (it.colorKey) {
          restoredColors[key] = String(it.colorKey).split(",").filter(Boolean);
        }
        if (it.varietyKey) {
          restoredVarieties[key] = String(it.varietyKey).split(",").filter(Boolean);
        }
      }
      if (Object.keys(restoredQuantities).length > 0) {
        setQuantities(restoredQuantities);
      }
      if (Object.keys(restoredColors).length > 0) {
        setItemColors(restoredColors);
      }
      if (Object.keys(restoredVarieties).length > 0) {
        setItemVarieties(restoredVarieties);
      }
      if (Object.keys(restoredEventChecked).length > 0) {
        setEventChecked(restoredEventChecked);
      }
      if (Object.keys(restoredSplitOpen).length > 0) {
        setSplitOpen(restoredSplitOpen);
      }
      if (typeof saved.freeformNotes === "string") {
        setFreeformNotes(saved.freeformNotes);
      }
    } catch {
      // Malformed payload — ignore. Worst case the chef re-enters quantities.
    }
    // Run once on mount; deps left intentionally empty so re-renders don't
    // wipe in-progress edits the chef has made since the restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter to only available/limited items, then by search query
  const allAvailable = availabilityItems.filter((ai) => ai.status !== "unavailable");
  const visibleItems = search.trim()
    ? allAvailable.filter((ai) => ai.item.name.toLowerCase().includes(search.toLowerCase().trim()))
    : allAvailable;

  // Restaurant-scoped section visibility:
  //   • Press Bar login → only the Press Bar section.
  //   • Press / Under-Study → the merged menu (regular + event items),
  //     Press Bar hidden (those items go to the bartender, not the kitchen).
  // Match by lowercased name so "Press Bar" / "press bar" / a future
  // capitalization tweak still all route to the same gate.
  const isPressBarChef = restaurantName.trim().toLowerCase() === "press bar";

  // Event items no longer render in a separate "Events Menu" section — every
  // item appears ONCE in the merged menu list, and items flagged
  // is_event_item carry a per-item "For an event" checkmark instead. Checked
  // lines submit with menuSection 'events' (persisting to
  // order_items.menu_section, migration 057, exactly as before). Items
  // flagged ONLY for events (show_in_regular_menu = false) still show in the
  // list, badged EVENTS, and always submit as events.
  //
  // A both-menus item can also be SPLIT: the main row keeps the regular
  // portion (plain keys) and an "Event portion" sub-row appears whose
  // quantity/color/note keys all derive from a prefixed clone id, so the two
  // portions stay independent and submit as two separate order lines.
  const isEventFlagged = (ai: AvailabilityItemWithItem): boolean =>
    Boolean(ai.item.is_event_item);
  const isEventOnly = (ai: AvailabilityItemWithItem): boolean =>
    isEventOnlyItem(ai.item);

  const asEventKeyAi = (ai: AvailabilityItemWithItem): AvailabilityItemWithItem =>
    ({ ...ai, id: `${EVENT_MENU_KEY_PREFIX}${ai.id}` });
  const realAvailId = (id: string): string =>
    id.startsWith(EVENT_MENU_KEY_PREFIX) ? id.slice(EVENT_MENU_KEY_PREFIX.length) : id;

  // The DB column may not exist on rows fetched before migration 030 has
  // run; treat undefined/null show_in_regular_menu as true to keep those
  // items in the menu.
  const pressBarItems = isPressBarChef
    ? visibleItems.filter((ai) => ai.item.is_press_bar_item)
    : [];
  const menuItems = isPressBarChef
    ? []
    : visibleItems.filter(
        (ai) => ai.item.show_in_regular_menu !== false || isEventFlagged(ai),
      );

  // While a split is open the main row is always the regular portion — the
  // whole-item checkmark is suppressed (the event portion is the sub-row).
  const sectionFor = (ai: AvailabilityItemWithItem): MenuSection => {
    if (isPressBarChef) return "press_bar";
    if (isEventOnly(ai)) return "events";
    return eventChecked[ai.id] && !splitOpen[ai.id] ? "events" : "regular";
  };

  // Flat list of every (item, section) pair the chef can order, computed from
  // the UNFILTERED catalog so search never drops an in-progress quantity.
  // Split-open items contribute a second, event-portion source whose clone id
  // makes its keys diverge from the regular portion's.
  type KeyedSource = { ai: AvailabilityItemWithItem; section: MenuSection };
  const orderedSources: KeyedSource[] = isPressBarChef
    ? allAvailable
        .filter((ai) => ai.item.is_press_bar_item)
        .map((ai) => ({ ai, section: "press_bar" as const }))
    : allAvailable
        .filter((ai) => ai.item.show_in_regular_menu !== false || isEventFlagged(ai))
        .flatMap((ai) => {
          const sources: KeyedSource[] = [{ ai, section: sectionFor(ai) }];
          if (splitOpen[ai.id]) sources.push({ ai: asEventKeyAi(ai), section: "events" });
          return sources;
        });

  function openSplit(id: string) {
    // The main row becomes the regular portion; the event side now lives on
    // the sub-row, so drop any whole-item event mark.
    setEventChecked((prev) => ({ ...prev, [id]: false }));
    setSplitOpen((prev) => ({ ...prev, [id]: true }));
  }

  function closeSplit(id: string) {
    // Clear the event portion's quantities/colors/note so nothing invisible
    // stays in the order after the sub-row disappears.
    const prefix = `${EVENT_MENU_KEY_PREFIX}${id}`;
    const dropPrefixed = <T,>(map: Record<string, T>): Record<string, T> =>
      Object.fromEntries(Object.entries(map).filter(([k]) => !k.startsWith(prefix)));
    setQuantities(dropPrefixed);
    setItemColors(dropPrefixed);
    setItemVarieties(dropPrefixed);
    setItemNotes(dropPrefixed);
    setSplitOpen((prev) => ({ ...prev, [id]: false }));
  }

  function groupByCategory(items: AvailabilityItemWithItem[]): Record<ItemCategory, AvailabilityItemWithItem[]> {
    return CATEGORY_ORDER.reduce<Record<ItemCategory, AvailabilityItemWithItem[]>>(
      (acc, cat) => {
        // Items within each category section sorted alphabetically by
        // name so chefs can scan a long list quickly. Case-insensitive
        // localeCompare so "Sage" and "sage" sort consistently.
        acc[cat] = items
          .filter((ai) => ai.item.category === cat)
          .sort((a, b) =>
            a.item.name.localeCompare(b.item.name, undefined, { sensitivity: "base" }),
          );
        return acc;
      },
      {} as Record<ItemCategory, AvailabilityItemWithItem[]>,
    );
  }

  const menuByCategory = groupByCategory(menuItems);
  const pressBarByCategory = groupByCategory(pressBarItems);

  const isSearching = search.trim().length > 0;

  function handleQuantityChange(key: string, qty: number) {
    setQuantities((prev) => ({ ...prev, [key]: qty }));
  }

  function handleNoteChange(id: string, note: string) {
    setItemNotes((prev) => ({ ...prev, [id]: note }));
  }

  /** Iterate every (unit?, size?) combination an item exposes, yielding its quantity key. */
  function enumerateKeys(ai: AvailabilityItemWithItem): Generator<{ key: string; unit?: UnitType; size?: string }> {
    return enumerateOrderKeys(
      ai.id,
      resolveUnits(ai.item, ai.available_units),
      resolveSizes(ai.item, ai.available_sizes),
    );
  }

  // Check if any item has quantity > 0 (across ALL items + portions, not just searched)
  const hasAnyOrdered = orderedSources.some(({ ai }) => {
    for (const { key } of enumerateKeys(ai)) if ((quantities[key] ?? 0) > 0) return true;
    return false;
  });

  // Total order lines with quantity > 0
  const orderedCount = orderedSources.reduce((count, { ai }) => {
    let n = 0;
    for (const { key } of enumerateKeys(ai)) if ((quantities[key] ?? 0) > 0) n++;
    return count + n;
  }, 0);

  function handleReview() {
    const orderedItems: OrderFormData["items"] = [];

    // A split item appears as two sources (regular + event portion) and so
    // produces two distinct lines for the same availability item.
    for (const { ai, section } of orderedSources) {
      const itemNote = itemNotes[ai.id] ?? "";

      for (const { key, unit, size } of enumerateKeys(ai)) {
        const qty = quantities[key] ?? 0;
        if (qty <= 0) continue;

        // Suffix the displayed name with unit + size + section when present
        const unitLabel = unit ? ((UNIT_LABELS as Record<string, string>)[unit] ?? unit.toUpperCase()) : null;
        const suffixParts = [unitLabel, size, section === "events" ? "Events" : null].filter(Boolean) as string[];
        const itemName = suffixParts.length > 0 ? `${ai.item.name} (${suffixParts.join(" · ")})` : ai.item.name;

        // Colors/varieties live at the same key as the qty
        const colors = itemColors[key] ?? [];
        const colorKey = colors.length > 0 ? colors.join(",") : null;
        const lineVarieties = itemVarieties[key] ?? [];
        const varietyKey = lineVarieties.length > 0 ? lineVarieties.join(",") : null;
        // Keep the human-readable color/variety note in itemNote for
        // backwards-compat displays; the structured colorKey/varietyKey
        // fields are what receiver/edit hydration round-trips through.
        const colorNote = colors.length > 0 ? `Color: ${colors.join(", ")}` : "";
        const varietyNote = lineVarieties.length > 0 ? `Variety: ${lineVarieties.join(", ")}` : "";
        const note = [varietyNote, colorNote, itemNote].filter(Boolean).join(" | ");

        // Persist the specific unit chosen (or fall back to whatever's on the item)
        const unitForOrder = unit ?? (String(ai.item.unit_type).split(",")[0]?.trim() || ai.item.unit_type);

        // Resolve per-unit price → fallback to default_price.
        // Frozen at submit time so future price changes don't rewrite history.
        const unitPrice = priceForUnit(
          {
            default_price: ai.item.default_price,
            unit_prices: ai.item.unit_prices as Record<string, number> | null,
            size_prices: (ai.item as any).size_prices as Record<string, number> | null,
          },
          unitForOrder,
          size,
        );

        orderedItems.push({
          availabilityItemId: realAvailId(ai.id),
          itemName,
          unitType: unitForOrder,
          sizeLabel: size ?? null,
          colorKey,
          varietyKey,
          menuSection: section,
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
      // New token per Review pass. The review page reuses it across submit
      // retries; only a fresh trip through this form mints a new one.
      idempotencyKey:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
            aria-label="Search items"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 min-h-[44px] text-base border border-farm-dark/10 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
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
          <p className="text-xs text-farm-green mt-1.5 px-1 tabular-nums">
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
            {/* ── MENU (Regular + Events merged) ────────────────── */}
            {menuItems.length > 0 && (
              <>
                {menuItems.some(isEventFlagged) && (
                  <p className="text-xs text-farm-muted mb-3 px-1 leading-relaxed">
                    Hosting an event? Items marked{" "}
                    <span className="text-pf-master-violet font-medium">EVENTS</span> can be
                    checked &ldquo;For an event&rdquo; once you add a quantity — or split
                    into separate regular and event portions.
                  </p>
                )}
                {CATEGORY_ORDER.map((cat) => {
                  const catItems = menuByCategory[cat];
                  if (catItems.length === 0) return null;
                  return (
                    <CategorySection
                      key={`menu-${cat}`}
                      category={cat}
                      items={catItems}
                      quantities={quantities}
                      itemNotes={itemNotes}
                      itemColors={itemColors}
                      itemVarieties={itemVarieties}
                      onQuantityChange={handleQuantityChange}
                      onNoteChange={handleNoteChange}
                      onColorChange={(key, colors) => setItemColors((prev) => ({ ...prev, [key]: colors }))}
                      onVarietyChange={(key, varieties) => setItemVarieties((prev) => ({ ...prev, [key]: varieties }))}
                      eventChecked={eventChecked}
                      onEventToggle={(id, checked) =>
                        setEventChecked((prev) => ({ ...prev, [id]: checked }))
                      }
                      splitOpen={splitOpen}
                      onOpenSplit={openSplit}
                      onCloseSplit={closeSplit}
                    />
                  );
                })}
              </>
            )}

            {/* ── PRESS BAR MENU ────────────────────────────────── */}
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
                      itemVarieties={itemVarieties}
                      onQuantityChange={handleQuantityChange}
                      onNoteChange={handleNoteChange}
                      onColorChange={(key, colors) => setItemColors((prev) => ({ ...prev, [key]: colors }))}
                      onVarietyChange={(key, varieties) => setItemVarieties((prev) => ({ ...prev, [key]: varieties }))}
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
