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

  // Track adjustments per order_item_id
  const [adjustments, setAdjustments] = useState<
    Record<string, { fulfilled: string; reason: string }>
  >(() => {
    const init: Record<string, { fulfilled: string; reason: string }> = {};
    for (const oi of orderItems) {
      init[oi.id] = {
        fulfilled: String(oi.isShorted ? (oi.quantityFulfilled ?? 0) : oi.quantityRequested),
        reason: "",
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

  async function handleSave() {
    setSaving(true);
    setError(null);

    // Build shortage items: only include items where fulfilled < requested
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
        className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium min-h-[44px] px-3"
      >
        <AlertTriangle className="w-4 h-4" />
        Mark Shortages
      </button>
    );
  }

  return (
    <div className="border border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-orange-800 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" />
          Mark Shortages
        </h3>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-orange-600 hover:text-orange-800 min-h-0"
        >
          Cancel
        </button>
      </div>

      <p className="text-xs text-orange-600">
        Adjust fulfilled quantities below. Items with less than requested will be marked as shorted.
      </p>

      <div className="space-y-2">
        {orderItems.map((oi) => {
          const adj = adjustments[oi.id];
          const fulfilled = parseFloat(adj.fulfilled);
          const isShort = isFinite(fulfilled) && fulfilled < oi.quantityRequested;

          return (
            <div key={oi.id} className={`bg-white rounded-lg px-3 py-2 ${isShort ? "ring-1 ring-orange-300" : ""}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900 truncate flex-1">{oi.itemName}</span>
                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                  Requested: {oi.quantityRequested} {oi.unit}
                </span>
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-20">
                  <input
                    type="number"
                    min="0"
                    max={oi.quantityRequested}
                    step="0.5"
                    value={adj.fulfilled}
                    onChange={(e) => updateItem(oi.id, "fulfilled", e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                </div>
                {isShort && (
                  <input
                    type="text"
                    value={adj.reason}
                    onChange={(e) => updateItem(oi.id, "reason", e.target.value)}
                    placeholder="Reason (e.g. pest damage)"
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 bg-orange-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 min-h-[44px]"
      >
        {saving ? "Saving..." : "Save Shortages & Notify Chef"}
      </button>
    </div>
  );
}
