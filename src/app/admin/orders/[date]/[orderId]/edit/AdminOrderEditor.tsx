"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, X } from "lucide-react";

export interface EditorLine {
  id: string;
  itemName: string;
  category: string;
  unit: string;
  sizeLabel: string | null;
  isEvent: boolean;
  quantity: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  unit_type: string; // comma-separated unit codes
  default_price: number | null;
  unit_prices: Record<string, number> | null;
}

export interface DeliveryDateOption {
  date: string;
  label: string;
  orderingOpen: boolean;
}

interface NewLine {
  tempId: string;
  item: CatalogItem;
  unit: string;
  quantity: string;
}

interface Props {
  orderId: string;
  /** The date segment in the URL we came from (for the back link). */
  sourceDate: string;
  restaurantName: string;
  currentDate: string;
  initialNotes: string;
  initialLines: EditorLine[];
  catalog: CatalogItem[];
  deliveryDates: DeliveryDateOption[];
}

/**
 * Admin full order editor — change the delivery date, edit/remove existing
 * lines, add catalog items, and edit notes. Posts the whole desired state to
 * PUT /api/orders/[orderId]/edit, which handles the date move (merging into an
 * existing order on the target date if one exists) and availability re-pointing.
 */
export function AdminOrderEditor({
  orderId,
  sourceDate,
  restaurantName,
  currentDate,
  initialNotes,
  initialLines,
  catalog,
  deliveryDates,
}: Props) {
  const router = useRouter();
  const [deliveryDate, setDeliveryDate] = useState(currentDate);
  const [notes, setNotes] = useState(initialNotes);
  const [lines, setLines] = useState<EditorLine[]>(initialLines);
  const [newLines, setNewLines] = useState<NewLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add-item picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const dateChanged = deliveryDate !== currentDate;

  const filtered = useMemo(() => {
    if (!search.trim()) return catalog.slice(0, 12);
    const q = search.toLowerCase().trim();
    return catalog.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 12);
  }, [search, catalog]);

  function setLineQty(id: string, value: string) {
    const qty = value === "" ? 0 : parseFloat(value);
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, quantity: Number.isFinite(qty) ? qty : 0 } : l)),
    );
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function addCatalogItem(item: CatalogItem) {
    const firstUnit = item.unit_type.split(",").map((u) => u.trim()).filter(Boolean)[0] ?? "ea";
    setNewLines((prev) => [
      ...prev,
      { tempId: `${item.id}-${Date.now()}`, item, unit: firstUnit, quantity: "1" },
    ]);
    setSearch("");
    setPickerOpen(false);
  }

  function setNewLineField(tempId: string, patch: Partial<NewLine>) {
    setNewLines((prev) => prev.map((nl) => (nl.tempId === tempId ? { ...nl, ...patch } : nl)));
  }

  function removeNewLine(tempId: string) {
    setNewLines((prev) => prev.filter((nl) => nl.tempId !== tempId));
  }

  async function handleSave() {
    setError(null);

    const kept_lines = lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({ id: l.id, quantity_requested: l.quantity }));

    const new_lines = newLines
      .map((nl) => ({
        item_id: nl.item.id,
        unit_type: nl.unit,
        quantity_requested: nl.quantity === "" ? 0 : parseFloat(nl.quantity),
      }))
      .filter((nl) => Number.isFinite(nl.quantity_requested) && nl.quantity_requested > 0);

    if (kept_lines.length === 0 && new_lines.length === 0) {
      setError("An order needs at least one item. To clear it, delete the order instead.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_date: deliveryDate,
          freeform_notes: notes.trim() || null,
          kept_lines,
          new_lines,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save order");
      // The order may have moved (and merged) — land on the target date's detail.
      const landedDate = json.data?.delivery_date ?? deliveryDate;
      router.push(`/admin/orders/${landedDate}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Failed to save order");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Delivery date */}
      <section className="card p-4 space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-farm-muted">
          Delivery date
        </label>
        <select
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          className="w-full min-h-[44px] text-sm border border-farm-dark/15 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-pf-master-blue"
        >
          {deliveryDates.map((d) => (
            <option key={d.date} value={d.date}>
              {d.label}
              {!d.orderingOpen ? " (ordering closed)" : ""}
            </option>
          ))}
        </select>
        {dateChanged && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
            Moving this order to a new date. If {restaurantName} already has an order on{" "}
            {deliveryDates.find((d) => d.date === deliveryDate)?.label ?? "that date"}, the items
            will be merged into it (matching lines have their quantities added).
          </p>
        )}
      </section>

      {/* Existing lines */}
      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-farm-dark/5">
          <h2 className="text-sm font-semibold text-farm-dark">Items</h2>
        </div>
        {lines.length === 0 && newLines.length === 0 && (
          <p className="px-4 py-6 text-sm text-farm-muted text-center">
            No items. Add at least one below.
          </p>
        )}
        <div className="divide-y divide-farm-dark/5">
          {lines.map((l) => (
            <div key={l.id} className="px-4 py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-farm-dark truncate">
                  {l.itemName}
                  {l.isEvent && (
                    <span className="ml-1.5 text-[10px] font-medium text-pf-master-violet uppercase tracking-wider">
                      Events
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-farm-muted uppercase tracking-wider">
                  {[l.unit, l.sizeLabel].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={l.quantity}
                onChange={(e) => setLineQty(l.id, e.target.value)}
                className="w-20 text-sm text-right border border-farm-dark/15 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-pf-master-blue"
              />
              <button
                type="button"
                onClick={() => removeLine(l.id)}
                aria-label={`Remove ${l.itemName}`}
                className="text-red-500 hover:text-red-700 p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          {/* Newly added (not yet saved) lines */}
          {newLines.map((nl) => {
            const units = nl.item.unit_type.split(",").map((u) => u.trim()).filter(Boolean);
            return (
              <div key={nl.tempId} className="px-4 py-3 bg-pf-master-blue/[0.04] flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-farm-dark truncate">
                    {nl.item.name}
                    <span className="ml-1.5 text-[10px] font-medium text-pf-master-blue uppercase tracking-wider">
                      New
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(units.length > 0 ? units : ["ea"]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setNewLineField(nl.tempId, { unit: u })}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium min-h-0 transition-colors ${
                          nl.unit === u
                            ? "bg-pf-master-blue text-white"
                            : "bg-white text-farm-dark/80 border border-farm-dark/10"
                        }`}
                      >
                        {u.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={nl.quantity}
                  onChange={(e) => setNewLineField(nl.tempId, { quantity: e.target.value })}
                  className="w-20 text-sm text-right border border-farm-dark/15 rounded-lg px-2 py-2 focus:outline-none focus:ring-2 focus:ring-pf-master-blue"
                />
                <button
                  type="button"
                  onClick={() => removeNewLine(nl.tempId)}
                  aria-label={`Remove ${nl.item.name}`}
                  className="text-red-500 hover:text-red-700 p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add item */}
        <div className="px-4 py-3 border-t border-farm-dark/5">
          {!pickerOpen ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="w-full min-h-[44px] rounded-xl border border-dashed border-pf-master-blue/30 text-sm font-medium text-pf-master-blue bg-white hover:bg-pf-master-blue/[0.04] transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add item
            </button>
          ) : (
            <div className="bg-pf-master-blue/[0.04] border border-pf-master-blue/20 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-farm-dark">Add an item</p>
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(false);
                    setSearch("");
                  }}
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
                    onClick={() => addCatalogItem(item)}
                    className="w-full px-3 py-2 text-left text-sm text-farm-dark hover:bg-farm-cream/40 min-h-[40px] flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{item.name}</span>
                    <span className="text-[10px] text-farm-muted uppercase tracking-wider flex-shrink-0">
                      {item.unit_type
                        .split(",")
                        .map((u) => u.trim().toUpperCase())
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Notes */}
      <section className="card p-4 space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-farm-muted">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Order notes…"
          className="w-full text-sm border border-farm-dark/15 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pf-master-blue resize-y"
        />
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {/* Sticky save bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-farm-dark/10 px-4 py-3 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(`/admin/orders/${sourceDate}`)}
            className="min-h-[44px] px-4 rounded-xl text-sm font-medium text-farm-muted border border-farm-dark/10 bg-white hover:bg-farm-cream/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 min-h-[44px] rounded-xl bg-pf-master-blue text-white text-sm font-semibold disabled:opacity-50 hover:bg-pf-master-blue/90 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
