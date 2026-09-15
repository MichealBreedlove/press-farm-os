"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, CATEGORY_ORDER, EVENT_MENU_KEY_PREFIX, MAX_NOTES_LENGTH, UNIT_LABELS } from "@/lib/constants";
import { formatDateShort, priceForUnit } from "@/lib/utils";
import { CategorySection } from "./category-section";
import { ItemSearchBar } from "./ItemSearchBar";
import { useItemPicker } from "./useItemPicker";
import { collectOrderedLines, countOrderedLines, groupByCategory } from "@/lib/order/lines";
import type { PickerSource } from "@/lib/order/lines";
import { OnboardingTour } from "./OnboardingTour";
import { ChefSuggestionBox } from "./ChefSuggestionBox";
import type { AvailabilityItemWithItem, ItemCategory } from "@/types";
import { resolveUnits, isEventOnlyItem } from "@/lib/order-availability";
import { buildOrderKey } from "@/lib/order-keys";

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
  /** Set when the form was prefilled from a past order (?reorder=). */
  reorderNotice?: { fromDate: string; placed: number; missing: string[] };
  /** Item ids on this restaurant's most recent order — powers the "Last order" chip. */
  lastOrderItemIds?: string[];
  lastOrderDate?: string | null;
  /** Pre-filled search (from /order?q=, e.g. a chef calendar crop tap). */
  initialSearch?: string;
}

type ChipFilter = "all" | "last" | ItemCategory;

/** Which menu a line was placed under. The chef form renders one merged list;
 *  'events' is set by the per-item "For an event" checkmark (automatic for
 *  events-only items) or by the event portion of a split line, and persists
 *  to order_items.menu_section. 'press_bar' lines never collide with the
 *  others, so they persist as NULL (same as 'regular'). */
export type { MenuSection } from "@/lib/order/lines";
import type { MenuSection } from "@/lib/order/lines";

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
  reorderNotice,
  lastOrderItemIds = [],
  lastOrderDate = null,
  initialSearch = "",
}: OrderFormProps) {
  const router = useRouter();
  const picker = useItemPicker({
    quantities: initialQuantities,
    itemColors: initialColors,
    itemVarieties: initialVarieties,
  });
  const { quantities, itemNotes, itemColors, itemVarieties, setQuantities, setItemColors, setItemVarieties } = picker;
  const [eventChecked, setEventChecked] = useState<Record<string, boolean>>(initialEventChecked);
  const [splitOpen, setSplitOpen] = useState<Record<string, boolean>>(initialSplitOpen);
  const [freeformNotes, setFreeformNotes] = useState(initialNotes);
  const [search, setSearch] = useState(initialSearch);
  const [chip, setChip] = useState<ChipFilter>("all");
  const [reorderDismissed, setReorderDismissed] = useState(false);

  // Rehydrate from sessionStorage on first mount when not editing — this
  // is what makes "Review Order → Back" preserve quantities. The review
  // page wrote press_farm_order before navigating; if the chef clicks
  // Back, OrderForm remounts fresh from server props and would otherwise
  // wipe the order. Restore it once if the saved snapshot matches this
  // restaurant + delivery date so we don't accidentally cross-contaminate
  // a different in-flight session.
  useEffect(() => {
    if (editingOrderId) return; // edit mode hydrates from order_items via props
    if (reorderNotice) return; // reorder prefill wins over any stale draft
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
  const lastOrderSet = new Set(lastOrderItemIds);
  const matchesChip = (ai: AvailabilityItemWithItem): boolean =>
    chip === "all" ? true : chip === "last" ? lastOrderSet.has(ai.item.id) : ai.item.category === chip;
  const visibleItems = allAvailable
    .filter((ai) => (search.trim() ? ai.item.name.toLowerCase().includes(search.toLowerCase().trim()) : true))
    .filter(matchesChip);

  // Chip row: All · Last order · each category that has something to order.
  const lastOrderCount = allAvailable.filter((ai) => lastOrderSet.has(ai.item.id)).length;
  const categoryCounts = CATEGORY_ORDER.map((cat) => ({
    cat,
    n: allAvailable.filter((ai) => ai.item.category === cat).length,
  })).filter((c) => c.n > 0);

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
  const orderedSources: PickerSource[] = isPressBarChef
    ? allAvailable
        .filter((ai) => ai.item.is_press_bar_item)
        .map((ai) => ({ ai, section: "press_bar" as const }))
    : allAvailable
        .filter((ai) => ai.item.show_in_regular_menu !== false || isEventFlagged(ai))
        .flatMap((ai) => {
          const sources: PickerSource[] = [{ ai, section: sectionFor(ai) }];
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
    picker.dropKeysWithPrefix(`${EVENT_MENU_KEY_PREFIX}${id}`);
    setSplitOpen((prev) => ({ ...prev, [id]: false }));
  }

  const menuByCategory = groupByCategory(menuItems);
  const pressBarByCategory = groupByCategory(pressBarItems);

  const isSearching = search.trim().length > 0;

  const { onQuantityChange: handleQuantityChange, onNoteChange: handleNoteChange } = picker.sectionHandlers;

  // Total order lines with quantity > 0 (across ALL items + portions, not
  // just the searched/filtered ones).
  const orderedCount = countOrderedLines(orderedSources, quantities);
  const hasAnyOrdered = orderedCount > 0;

  function handleReview() {
    // Shared flatten: a split item appears as two sources (regular + event
    // portion) and so produces two distinct lines for the same row.
    const orderedItems: OrderFormData["items"] = collectOrderedLines(orderedSources, picker.maps, realAvailId).map(
      (line) => {
        const { ai, unit, unitExplicit, size, colors, varieties, section, quantity, itemNote } = line;
        // Suffix the displayed name with unit + size + section when present
        const unitLabel = unitExplicit ? ((UNIT_LABELS as Record<string, string>)[unit] ?? unit.toUpperCase()) : null;
        const suffixParts = [unitLabel, size, section === "events" ? "Events" : null].filter(Boolean) as string[];
        const itemName = suffixParts.length > 0 ? `${ai.item.name} (${suffixParts.join(" · ")})` : ai.item.name;

        // Keep the human-readable color/variety note in itemNote for
        // backwards-compat displays; the structured colorKey/varietyKey
        // fields are what receiver/edit hydration round-trips through.
        const colorNote = colors.length > 0 ? `Color: ${colors.join(", ")}` : "";
        const varietyNote = varieties.length > 0 ? `Variety: ${varieties.join(", ")}` : "";
        const note = [varietyNote, colorNote, itemNote].filter(Boolean).join(" | ");

        // Resolve per-unit price → fallback to default_price.
        // Frozen at submit time so future price changes don't rewrite history.
        const unitPrice = priceForUnit(
          {
            default_price: ai.item.default_price,
            unit_prices: ai.item.unit_prices as Record<string, number> | null,
            size_prices: (ai.item as any).size_prices as Record<string, number> | null,
          },
          unit,
          size ?? undefined,
        );

        return {
          availabilityItemId: line.availabilityItemId,
          itemName,
          unitType: unit,
          sizeLabel: size,
          colorKey: colors.length > 0 ? colors.join(",") : null,
          varietyKey: varieties.length > 0 ? varieties.join(",") : null,
          menuSection: section,
          quantity,
          unitPrice,
          itemNote: note,
        };
      },
    );

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
      {/* Sticky search bar — shared with the Events order form */}
      <ItemSearchBar value={search} onChange={setSearch}>
        {/* Filter chips — category + "Last order" */}
        {(categoryCounts.length > 1 || lastOrderCount > 0) && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 mt-2.5 pb-0.5" role="group" aria-label="Filter items">
            {([
              { key: "all" as ChipFilter, label: "All", n: allAvailable.length },
              ...(lastOrderCount > 0
                ? [{ key: "last" as ChipFilter, label: lastOrderDate ? `Last order · ${formatDateShort(lastOrderDate)}` : "Last order", n: lastOrderCount }]
                : []),
              ...categoryCounts.map((c) => ({ key: c.cat as ChipFilter, label: CATEGORY_LABELS[c.cat], n: c.n })),
            ]).map((c) => {
              const on = chip === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setChip(on && c.key !== "all" ? "all" : c.key)}
                  aria-pressed={on}
                  className={`flex-shrink-0 inline-flex items-center gap-1 rounded-full border px-3 min-h-[36px] text-xs font-medium transition-colors ${
                    on
                      ? "bg-farm-dark text-white border-farm-dark"
                      : "bg-white text-farm-muted border-farm-dark/10 hover:border-farm-dark/30"
                  }`}
                >
                  {c.label}
                  <span className={`tabular-nums ${on ? "text-white/70" : "text-farm-muted/60"}`}>{c.n}</span>
                </button>
              );
            })}
          </div>
        )}
        {orderedCount > 0 && (
          <p className="text-xs text-farm-green mt-1.5 px-1 tabular-nums">
            {orderedCount} item{orderedCount !== 1 ? "s" : ""} in your order
          </p>
        )}
      </ItemSearchBar>

      {/* Reorder notice — what carried over from the past order, what didn't */}
      {reorderNotice && !reorderDismissed && (
        <div className="mx-4 mt-4 rounded-xl border border-farm-green/25 bg-farm-green-light/60 px-4 py-3 flex items-start gap-3">
          <div className="flex-1 min-w-0 text-sm text-farm-dark">
            <p className="font-medium">
              Prefilled from your {formatDateShort(reorderNotice.fromDate)} order
              <span className="text-farm-muted font-normal"> · {reorderNotice.placed} line{reorderNotice.placed === 1 ? "" : "s"}</span>
            </p>
            {reorderNotice.missing.length > 0 && (
              <p className="text-xs text-farm-muted mt-1 leading-snug">
                Not available for this date: {reorderNotice.missing.join(", ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setReorderDismissed(true)}
            aria-label="Dismiss"
            className="w-9 h-9 -mr-2 -mt-1 flex items-center justify-center text-farm-muted hover:text-farm-dark"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex-1 px-4 py-4 pb-32">
        {visibleItems.length === 0 ? (
          <div className="text-center py-12 text-farm-muted text-sm">
            {search
              ? `No items match "${search}"`
              : chip !== "all"
                ? "Nothing in this filter for this delivery."
                : "No items available for this delivery."}
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
                      onColorChange={picker.sectionHandlers.onColorChange}
                      onVarietyChange={picker.sectionHandlers.onVarietyChange}
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
                      onColorChange={picker.sectionHandlers.onColorChange}
                      onVarietyChange={picker.sectionHandlers.onVarietyChange}
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
