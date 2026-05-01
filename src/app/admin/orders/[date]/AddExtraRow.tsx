"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

interface ItemOption {
  id: string;
  name: string;
  category: string;
  unit_type: string; // comma-separated unit codes (e.g. "sm,lg")
  default_price: number | null;
  unit_prices: Record<string, number> | null;
}

interface Props {
  orderId: string;
  /** Full catalog of non-archived items so admin can pick anything to add as extra. */
  allItems: ItemOption[];
}

/**
 * Inline "Add Extra Item" row that lives at the bottom of each restaurant
 * section on /admin/orders/[date]. Lets admin throw additional produce into
 * a delivery during pick-and-pack — items that weren't on the chef's order.
 *
 * Behaviour:
 *  - Tap "+ Add Extra Item" → expand inline form
 *  - Search items by name; pick one
 *  - Pick a unit from the item's container list (or fall back to "ea")
 *  - Enter quantity → submit
 *  - On success: tiny "Added" confirmation, the form resets so admin can add
 *    another, and router.refresh() so the page re-fetches and the new line
 *    appears in the receiver email diff next time it's sent.
 */
export function AddExtraRow({ orderId, allItems }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ItemOption | null>(null);
  const [unit, setUnit] = useState("");
  const [quantity, setQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return allItems.slice(0, 12);
    const q = search.toLowerCase().trim();
    return allItems.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 12);
  }, [search, allItems]);

  function pick(item: ItemOption) {
    setSelected(item);
    // Default to the item's first declared unit, fallback to "ea"
    const firstUnit = item.unit_type.split(",").map((u) => u.trim()).filter(Boolean)[0];
    setUnit(firstUnit ?? "ea");
    setSearch("");
  }

  function reset() {
    setSelected(null);
    setUnit("");
    setQuantity("");
    setError(null);
  }

  async function handleSubmit() {
    if (!selected) return;
    const qty = parseFloat(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Enter a quantity > 0");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/extras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: selected.id, quantity: qty, unit }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add");
      setConfirmation(`Added ${qty} ${unit.toUpperCase()} of ${selected.name}`);
      reset();
      router.refresh();
      setTimeout(() => setConfirmation(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full min-h-[44px] mt-2 rounded-xl border border-dashed border-pf-master-blue/30 text-sm font-medium text-pf-master-blue bg-white hover:bg-pf-master-blue/[0.04] transition-colors flex items-center justify-center gap-1.5"
      >
        <span className="text-base leading-none">+</span>
        Add Extra Item
      </button>
    );
  }

  // Item NOT yet picked: search + pick
  if (!selected) {
    return (
      <div className="mt-2 bg-pf-master-blue/[0.04] border border-pf-master-blue/20 rounded-xl p-3 space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-farm-dark">Add an extra item</p>
          <button
            type="button"
            onClick={() => { setOpen(false); reset(); }}
            className="text-xs text-farm-muted hover:text-farm-dark"
          >
            Cancel
          </button>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          autoFocus
          className="w-full text-sm border border-farm-dark/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pf-master-blue"
        />
        <div className="max-h-64 overflow-y-auto rounded-lg border border-farm-dark/5 bg-white divide-y divide-farm-dark/5">
          {filtered.length === 0 && (
            <p className="px-3 py-4 text-xs text-farm-muted text-center">No items match.</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item)}
              className="w-full px-3 py-2 text-left text-sm text-farm-dark hover:bg-farm-cream/40 min-h-[40px] flex items-center justify-between gap-2"
            >
              <span className="truncate">{item.name}</span>
              <span className="text-[10px] text-farm-muted uppercase tracking-wider flex-shrink-0">
                {item.unit_type.split(",").map((u) => u.trim().toUpperCase()).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Item picked: enter qty + unit + submit
  const availableUnits = selected.unit_type.split(",").map((u) => u.trim()).filter(Boolean);

  return (
    <div className="mt-2 bg-pf-master-blue/[0.04] border border-pf-master-blue/20 rounded-xl p-3 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs text-pf-master-blue font-semibold uppercase tracking-wider">Adding</p>
          <p className="text-sm font-semibold text-farm-dark mt-0.5">{selected.name}</p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-farm-muted hover:text-farm-dark"
        >
          Change
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-1">
          <label className="block text-[10px] text-farm-muted uppercase tracking-wider mb-1">Qty</label>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0"
            className="w-full text-sm border border-farm-dark/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pf-master-blue"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] text-farm-muted uppercase tracking-wider mb-1">Unit</label>
          <div className="flex flex-wrap gap-1">
            {availableUnits.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium min-h-0 transition-colors ${
                  unit === u
                    ? "bg-pf-master-blue text-white"
                    : "bg-white text-farm-dark/80 border border-farm-dark/10 hover:border-pf-master-blue/30"
                }`}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex-1 min-h-[40px] rounded-lg border border-farm-dark/10 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !quantity}
          className="flex-1 min-h-[40px] rounded-lg bg-pf-master-blue text-white text-sm font-semibold disabled:opacity-50 hover:bg-pf-master-blue/90"
        >
          {submitting ? "Adding…" : "Add to Delivery"}
        </button>
      </div>

      {confirmation && (
        <p className="text-xs text-farm-green font-medium text-center">✓ {confirmation}</p>
      )}
    </div>
  );
}
