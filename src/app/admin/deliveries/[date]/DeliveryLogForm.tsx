"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/constants";
import { resolveOrderUnitPrice } from "@/lib/pricing";

type Restaurant = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  category: string;
  unit_type: string;
  default_price: number | null;
  /** Per-unit price overrides keyed by unit code (items.unit_prices). */
  unit_prices?: Record<string, number> | null;
  /** Per-size price overrides keyed by size label (items.size_prices) — most specific tier. */
  size_prices?: Record<string, number> | null;
  /** Comma-separated size options (", "-joined free text), e.g. "Dime, Palm". */
  size?: string | null;
  is_archived?: boolean;
};
type DeliveryItem = {
  item_id: string;
  quantity: number;
  unit: string;
  unit_price: number;
  size_label?: string | null;
};
type ExistingDelivery = {
  id: string;
  restaurant_id: string;
  status: string;
  notes: string | null;
  total_value: number | null;
  delivery_items: DeliveryItem[];
};
type Order = {
  id: string;
  restaurant_id: string;
  status: string;
  order_items: {
    item_id: string;
    quantity_ordered: number;
    quantity_fulfilled: number | null;
    unit: string;
    unit_price: number | null;
    size_label?: string | null;
  }[];
};

type LineItem = {
  item_id: string;
  name: string;
  category: string;
  quantity: string;
  unit: string;
  unit_price: string;
  size_label: string;
  is_bonus: boolean;
  bonus_note: string;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function lineTotal(qty: string, price: string): number {
  const q = parseFloat(qty);
  const p = parseFloat(price);
  if (!isFinite(q) || !isFinite(p)) return 0;
  return Math.round(q * p * 100) / 100;
}

export default function DeliveryLogForm({
  date,
  restaurants,
  items,
  existingDeliveries,
  orders,
}: {
  date: string;
  restaurants: Restaurant[];
  items: Item[];
  existingDeliveries: ExistingDelivery[];
  orders: Order[];
}) {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showItemPicker, setShowItemPicker] = useState(false);

  const itemMap = Object.fromEntries(items.map((i) => [i.id, i]));

  // Build initial lines when restaurant changes
  const buildLines = useCallback((restId: string) => {
    // Check for existing delivery
    const existing = existingDeliveries.find((d) => d.restaurant_id === restId);
    if (existing?.delivery_items?.length) {
      return existing.delivery_items.map((di: any) => {
        const item = itemMap[di.item_id];
        return {
          item_id: di.item_id,
          name: item?.name ?? di.item_id,
          category: item?.category ?? "fruit_veg",
          quantity: String(di.quantity),
          unit: di.unit,
          unit_price: String(di.unit_price),
          size_label: di.size_label ?? "",
          is_bonus: di.is_bonus ?? false,
          bonus_note: di.bonus_note ?? "",
        };
      });
    }
    // Pre-populate from order
    const order = orders.find((o) => o.restaurant_id === restId);
    if (order?.order_items?.length) {
      return order.order_items
        .filter((oi) => (oi.quantity_fulfilled ?? oi.quantity_ordered) > 0)
        .map((oi) => {
          const item = itemMap[oi.item_id];
          return {
            item_id: oi.item_id,
            name: item?.name ?? oi.item_id,
            category: item?.category ?? "fruit_veg",
            quantity: String(oi.quantity_fulfilled ?? oi.quantity_ordered),
            unit: oi.unit,
            unit_price: String(oi.unit_price ?? item?.default_price ?? 0),
            size_label: oi.size_label ?? "",
            is_bonus: false,
            bonus_note: "",
          };
        });
    }
    return [];
  }, [existingDeliveries, orders, itemMap]); // eslint-disable-line

  useEffect(() => {
    if (!restaurantId) return;
    const existing = existingDeliveries.find((d) => d.restaurant_id === restaurantId);
    setNotes(existing?.notes ?? "");
    setLines(buildLines(restaurantId));
    setSaved(false);
    setError(null);
  }, [restaurantId]); // eslint-disable-line

  const total = lines.reduce(
    (sum, l) => sum + lineTotal(l.quantity, l.unit_price),
    0
  );

  function updateLine(idx: number, field: keyof LineItem, value: string | boolean) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    );
  }

  function priceInfoFor(item: Item | undefined) {
    if (!item) return null;
    return {
      unitPrices: item.unit_prices ?? {},
      defaultPrice: item.default_price,
      sizePrices: item.size_prices ?? null,
    };
  }

  // Changing the container re-resolves the price from the catalog
  // (size_prices[size] → unit_prices[unit] → default_price) so each
  // container shows its own price. Admin can still override afterward.
  function changeUnit(idx: number, unit: string) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const info = priceInfoFor(itemMap[l.item_id]);
        if (!info) return { ...l, unit };
        return {
          ...l,
          unit,
          unit_price: String(resolveOrderUnitPrice(info, unit, l.size_label || null)),
        };
      })
    );
  }

  // Size changes only re-resolve the price for items that actually have
  // size-tier pricing — otherwise a manual price edit would be clobbered.
  function changeSize(idx: number, size: string) {
    setLines((prev) =>
      prev.map((l, i) => {
        if (i !== idx) return l;
        const item = itemMap[l.item_id];
        const hasSizePrices =
          item?.size_prices && Object.keys(item.size_prices).length > 0;
        if (!hasSizePrices) return { ...l, size_label: size };
        const info = priceInfoFor(item);
        return {
          ...l,
          size_label: size,
          unit_price: String(resolveOrderUnitPrice(info, l.unit || null, size || null)),
        };
      })
    );
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function addItem(item: Item) {
    if (lines.some((l) => l.item_id === item.id)) {
      setShowItemPicker(false);
      return;
    }
    // unit_type may be "sm,lg" for multi-unit items. A single-unit item
    // pre-selects its only container; a multi-unit item starts unselected so
    // the admin picks the container from the dropdown (the price fills in on
    // pick, since each container can carry its own price).
    const units =
      String(item.unit_type ?? "").split(",").map((u: string) => u.trim()).filter(Boolean);
    const unit = units.length > 1 ? "" : units[0] ?? "ea";
    // For a pre-selected unit, pre-fill the price with the canonical catalog
    // precedence (unit_prices[unit] → default_price → 0; no size chosen yet,
    // so the size tier can't apply). Admin can still edit the price.
    const prefillPrice = unit
      ? resolveOrderUnitPrice(
          {
            unitPrices: item.unit_prices ?? {},
            defaultPrice: item.default_price,
            sizePrices: item.size_prices ?? null,
          },
          unit,
          null,
        )
      : "";
    setLines((prev) => [
      ...prev,
      {
        item_id: item.id,
        name: item.name,
        category: item.category,
        quantity: "1",
        unit,
        unit_price: String(prefillPrice),
        size_label: "",
        is_bonus: false,
        bonus_note: "",
      },
    ]);
    setShowItemPicker(false);
    setSearchTerm("");
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const missingUnit = lines.filter(
      (l) => parseFloat(l.quantity) > 0 && !l.unit.trim()
    );
    if (missingUnit.length > 0) {
      setError(
        `Choose a container for: ${missingUnit.map((l) => l.name).join(", ")}`
      );
      setSaving(false);
      return;
    }

    const validLines = lines.filter(
      (l) => parseFloat(l.quantity) > 0 && parseFloat(l.unit_price) >= 0
    );

    if (validLines.length === 0) {
      setError("Add at least one item with quantity > 0");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_date: date,
          restaurant_id: restaurantId,
          notes: notes || undefined,
          items: validLines.map((l) => ({
            item_id: l.item_id,
            quantity: parseFloat(l.quantity),
            unit: l.unit.trim().toLowerCase(),
            unit_price: parseFloat(l.unit_price),
            size_label: l.size_label || null,
            is_bonus: l.is_bonus,
            bonus_note: l.bonus_note || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch (_e) {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // Group lines by category
  const grouped: Record<string, LineItem[]> = {};
  for (const line of lines) {
    if (!grouped[line.category]) grouped[line.category] = [];
    grouped[line.category].push(line);
  }

  // Picker excludes archived items — itemMap above still includes them
  // so old delivery rows that reference an archived item can still
  // resolve their display name instead of falling back to the UUID.
  const filteredItems = items.filter(
    (i) =>
      !i.is_archived &&
      !lines.some((l) => l.item_id === i.id) &&
      (searchTerm === "" ||
        i.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const existing = existingDeliveries.find((d) => d.restaurant_id === restaurantId);
  const isFinalized = existing?.status === "finalized";

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Restaurant tabs */}
      {restaurants.length > 1 && (
        <div className="flex rounded-lg bg-farm-cream/60 p-1">
          {restaurants.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setRestaurantId(r.id)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                restaurantId === r.id
                  ? "bg-white text-farm-dark shadow-sm"
                  : "text-farm-muted"
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {isFinalized && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-700 font-medium">This delivery is finalized</p>
          <p className="text-xs text-amber-600 mt-0.5">Editing is disabled after finalization</p>
        </div>
      )}

      {/* Pre-populated notice */}
      {!existing && orders.some((o) => o.restaurant_id === restaurantId) && lines.length > 0 && (
        <div className="bg-farm-cream/60 border border-farm-green/15 rounded-xl px-4 py-3">
          <p className="text-xs text-farm-green">
            Pre-populated from order — adjust quantities and prices as needed
          </p>
        </div>
      )}

      {/* Line items grouped by category */}
      {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => (
        <div key={cat}>
          <p className="text-xs font-semibold text-farm-muted uppercase tracking-wide mb-2">
            {CATEGORY_LABELS[cat]}
          </p>
          <div className="bg-white border border-farm-dark/5 rounded-xl overflow-hidden shadow-sm">
            {grouped[cat].map((line) => {
              const idx = lines.indexOf(line);
              const lt = lineTotal(line.quantity, line.unit_price);
              const itemSizes = String(itemMap[line.item_id]?.size ?? "")
                .split(", ").map((s) => s.trim()).filter(Boolean);
              const itemUnits = String(itemMap[line.item_id]?.unit_type ?? "")
                .split(",").map((u) => u.trim().toLowerCase()).filter(Boolean);
              return (
                <div
                  key={line.item_id}
                  className="px-4 py-3 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-farm-dark">{line.name}</p>
                        {line.is_bonus && <span className="badge-gold">Bonus</span>}
                      </div>
                      {!isFinalized && (
                        <div className="flex items-center gap-2 mt-1">
                          <button
                            type="button"
                            onClick={() => updateLine(idx, "is_bonus" as any, (!line.is_bonus) as any)}
                            className={`text-[10px] px-2 py-0.5 rounded-full min-h-0 min-w-0 transition-colors ${
                              line.is_bonus
                                ? "bg-amber-100 text-amber-700"
                                : "bg-farm-cream/60 text-farm-muted hover:bg-amber-50 hover:text-amber-600"
                            }`}
                          >
                            {line.is_bonus ? "Bonus item" : "Mark as bonus"}
                          </button>
                          {line.is_bonus && (
                            <input
                              type="text"
                              value={line.bonus_note}
                              onChange={(e) => updateLine(idx, "bonus_note" as any, e.target.value)}
                              placeholder="e.g. Sample, Family meal..."
                              className="text-xs border border-farm-dark/10 rounded px-2 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-farm-green"
                            />
                          )}
                        </div>
                      )}
                    </div>
                    {!isFinalized && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="text-farm-muted/60 hover:text-red-400 p-1 -mr-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {itemSizes.length > 0 && (
                    <div className="mb-2">
                      <label className="text-xs text-farm-muted">Size</label>
                      <select
                        value={line.size_label}
                        onChange={(e) => changeSize(idx, e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-2 border border-farm-dark/10 rounded-lg text-sm mt-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-farm-green disabled:bg-farm-cream/40 disabled:text-farm-muted"
                      >
                        <option value="">No size</option>
                        {itemSizes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        {line.size_label && !itemSizes.includes(line.size_label) && (
                          <option value={line.size_label}>{line.size_label}</option>
                        )}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="text-xs text-farm-muted">Qty</label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-2 border border-farm-dark/10 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-farm-green disabled:bg-farm-cream/40 disabled:text-farm-muted"
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-xs text-farm-muted">Unit</label>
                      <select
                        value={line.unit}
                        onChange={(e) => changeUnit(idx, e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-2 border border-farm-dark/10 rounded-lg text-sm mt-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-farm-green disabled:bg-farm-cream/40 disabled:text-farm-muted uppercase"
                      >
                        {!line.unit && <option value="">—</option>}
                        {itemUnits.map((u) => (
                          <option key={u} value={u}>{u.toUpperCase()}</option>
                        ))}
                        {line.unit && !itemUnits.includes(line.unit) && (
                          <option value={line.unit}>{line.unit.toUpperCase()}</option>
                        )}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-farm-muted">Price/unit</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => updateLine(idx, "unit_price", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-2 border border-farm-dark/10 rounded-lg text-sm mt-0.5 focus:outline-none focus:ring-2 focus:ring-farm-green disabled:bg-farm-cream/40 disabled:text-farm-muted"
                      />
                    </div>
                    <div className="text-right pt-4">
                      <p className="text-sm font-medium text-farm-dark/80">
                        {formatCurrency(lt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {lines.length === 0 && !isFinalized && (
        <div className="text-center py-10">
          <img src="/assets/pressfarm/flowers/squash-blossom.png" alt="" aria-hidden="true" className="mx-auto h-24 w-auto mb-4" />
          <h3 className="text-base font-semibold text-farm-dark">No deliveries logged for this restaurant</h3>
          <p className="text-sm text-farm-muted mt-1.5 max-w-sm mx-auto">
            Add items below as you pack and deliver. Each line tracks quantity, unit price, and bonus items.
          </p>
        </div>
      )}

      {/* Add item button */}
      {!isFinalized && (
        <button
          type="button"
          onClick={() => setShowItemPicker(true)}
          className="w-full py-3 border-2 border-dashed border-farm-dark/10 rounded-xl text-sm text-farm-muted hover:border-farm-green hover:text-farm-green transition-colors"
        >
          + Add Item
        </button>
      )}

      {/* Item picker modal — z-[60] sits above the admin BottomNav (z-50)
          so the search results aren't clipped behind the nav on mobile. */}
      {showItemPicker && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white rounded-t-2xl w-full max-h-[85vh] flex flex-col">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <h3 className="font-semibold text-farm-dark">Add Item</h3>
              <button
                type="button"
                onClick={() => { setShowItemPicker(false); setSearchTerm(""); }}
                className="text-farm-muted p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 pb-2">
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 border border-farm-dark/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            <div className="overflow-y-auto flex-1 px-4 pb-4">
              {filteredItems.length === 0 ? (
                <p className="text-center text-farm-muted text-sm py-4">No items found</p>
              ) : (
                CATEGORY_ORDER.map((cat) => {
                  const catItems = filteredItems.filter((i) => i.category === cat);
                  if (!catItems.length) return null;
                  return (
                    <div key={cat} className="mb-3">
                      <p className="text-xs font-semibold text-farm-muted uppercase tracking-wide mb-1">
                        {CATEGORY_LABELS[cat]}
                      </p>
                      {catItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => addItem(item)}
                          className="w-full flex items-center justify-between py-2.5 px-1 border-b border-gray-50 text-left hover:bg-farm-cream/40 rounded"
                        >
                          <span className="text-sm text-farm-dark">{item.name}</span>
                          <span className="text-xs text-farm-muted">
                            {formatCurrency(item.default_price ?? 0)} / {item.unit_type}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {!isFinalized && (
        <div>
          <label className="block text-sm font-medium text-farm-dark/80 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any delivery notes..."
            className="w-full px-3 py-2 border border-farm-dark/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-farm-green resize-none"
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {saved && (
        <p className="text-sm text-farm-green bg-farm-green-light rounded-lg px-3 py-2">
          Delivery saved!
        </p>
      )}

      {/* Total + Save */}
      {!isFinalized && (
        <div className="fixed bottom-nav-safe left-0 right-0 px-4 py-3 bg-white border-t border-farm-dark/5"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-farm-muted">Delivery Total</p>
              <p className="text-xl font-bold text-farm-dark">{formatCurrency(total)}</p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || lines.length === 0}
              className="btn-primary px-6 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Delivery"}
            </button>
          </div>
        </div>
      )}

      {isFinalized && (
        <div className="bg-farm-cream/40 border border-farm-dark/5 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-farm-muted">Total</p>
          <p className="text-lg font-bold text-farm-dark">
            {formatCurrency(existing?.total_value ?? total)}
          </p>
        </div>
      )}
    </div>
  );
}
