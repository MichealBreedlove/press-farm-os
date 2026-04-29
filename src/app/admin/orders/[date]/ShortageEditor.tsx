"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface OrderItemForShortage {
  id: string;
  itemName: string;
  unit: string;
  quantityRequested: number;
  quantityFulfilled: number | null;
  isShorted: boolean;
}

const QUICK_REASONS = [
  "Out of stock",
  "Pest damage",
  "Bolted",
  "Weather",
  "Quality",
];

export function ShortageEditor({
  orderId,
  orderItems,
}: {
  orderId: string;
  orderItems: OrderItemForShortage[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track adjustments per order_item_id — pre-populated with full requested qty
  const [adjustments, setAdjustments] = useState<
    Record<string, { fulfilled: string; reason: string }>
  >(() => {
    const init: Record<string, { fulfilled: string; reason: string }> = {};
    for (const oi of orderItems) {
      init[oi.id] = {
        fulfilled: String(oi.isShorted ? (oi.quantityFulfilled ?? 0) : oi.quantityRequested),
        reason: oi.isShorted ? "" : "",
      };
    }
    return init;
  });

  function updateItem(id: string, field: "fulfilled" | "reason", value: string) {
    setAdjustments((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  function adjustBy(id: string, delta: number) {
    setAdjustments((prev) => {
      const current = parseFloat(prev[id].fulfilled) || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: { ...prev[id], fulfilled: String(next) } };
    });
  }

  function setToZero(id: string) {
    setAdjustments((prev) => ({ ...prev, [id]: { ...prev[id], fulfilled: "0" } }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const shortageItems = orderItems
      .filter((oi) => {
        const adj = adjustments[oi.id];
        const fulfilled = parseFloat(adj.fulfilled);
        return isFinite(fulfilled) && fulfilled < oi.quantityRequested;
      })
      .map((oi) => {
        const adj = adjustments[oi.id];
        return {
          order_item_id: oi.id,
          quantity_fulfilled: parseFloat(adj.fulfilled),
          shortage_reason: adj.reason || "Supply limitation",
        };
      });

    if (shortageItems.length === 0) {
      setError("No shortages to save — all fulfilled quantities match or exceed requested.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/shortage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: shortageItems }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save shortages");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-pf-master-orange font-medium min-h-[44px] px-3"
      >
        <AlertTriangle className="w-4 h-4" />
        Mark Shortages
      </button>
    );
  }

  // Count items that will be marked as shorted
  const shortedCount = orderItems.filter(oi => {
    const f = parseFloat(adjustments[oi.id].fulfilled);
    return isFinite(f) && f < oi.quantityRequested;
  }).length;

  return (
    <div className="border border-orange-200 bg-pf-master-orange/8 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />
          Mark Shortages
        </h3>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-orange-600 hover:text-orange-800 min-h-[36px] px-2"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-orange-600">
        Adjust fulfilled quantities — tap &minus; to reduce, or 0 to short fully. Items with less than requested will be flagged.
      </p>

      <div className="space-y-2">
        {orderItems.map((oi) => {
          const adj = adjustments[oi.id];
          const fulfilled = parseFloat(adj.fulfilled);
          const isShort = isFinite(fulfilled) && fulfilled < oi.quantityRequested;

          return (
            <div key={oi.id} className={`bg-white rounded-lg px-3 py-2.5 ${isShort ? "ring-1 ring-orange-300" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-farm-dark truncate">{oi.itemName}</p>
                  <p className="text-xs text-farm-muted mt-0.5">
                    Requested: <span className="font-semibold">{oi.quantityRequested}</span> {oi.unit}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => adjustBy(oi.id, -1)}
                    disabled={fulfilled <= 0}
                    className="w-10 h-10 rounded-full bg-orange-100 text-pf-master-orange flex items-center justify-center text-lg font-medium disabled:opacity-30"
                    aria-label={`Decrease ${oi.itemName}`}
                  >&minus;</button>
                  <input
                    type="number"
                    min="0"
                    max={oi.quantityRequested}
                    step="0.5"
                    value={adj.fulfilled}
                    onChange={(e) => updateItem(oi.id, "fulfilled", e.target.value)}
                    className="w-14 h-10 text-center text-sm font-semibold border border-farm-dark/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <button
                    type="button"
                    onClick={() => adjustBy(oi.id, 1)}
                    disabled={fulfilled >= oi.quantityRequested}
                    className="w-10 h-10 rounded-full bg-orange-100 text-pf-master-orange flex items-center justify-center text-lg font-medium disabled:opacity-30"
                    aria-label={`Increase ${oi.itemName}`}
                  >+</button>
                  <button
                    type="button"
                    onClick={() => setToZero(oi.id)}
                    className="ml-1 text-[10px] px-2 h-10 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100"
                  >0</button>
                </div>
              </div>
              {isShort && (
                <div className="space-y-1.5 mt-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {QUICK_REASONS.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => updateItem(oi.id, "reason", r)}
                        className={`text-[10px] px-2 py-1 rounded-full transition-colors ${
                          adj.reason === r
                            ? "bg-orange-600 text-white"
                            : "bg-orange-100 text-pf-master-orange hover:bg-orange-200"
                        }`}
                      >{r}</button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={adj.reason}
                    onChange={(e) => updateItem(oi.id, "reason", e.target.value)}
                    placeholder="Or type a custom reason..."
                    className="w-full px-2 py-1.5 border border-farm-dark/10 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving || shortedCount === 0}
        className="w-full py-3 bg-orange-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 min-h-[44px]"
      >
        {saving ? "Saving..." : shortedCount === 0
          ? "No shortages to save"
          : `Save ${shortedCount} Shortage${shortedCount !== 1 ? "s" : ""} & Notify Chef`}
      </button>
    </div>
  );
}
