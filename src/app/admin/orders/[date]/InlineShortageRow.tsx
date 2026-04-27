"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, X } from "lucide-react";
import { formatQty } from "@/lib/utils";
import { UNIT_LABELS } from "@/lib/constants";

interface OrderItemForRow {
  id: string;
  itemName: string;
  category: string;
  unitType: string;
  quantityRequested: number;
  quantityFulfilled: number | null;
  isShorted: boolean;
  shortageReason: string | null;
}

interface Props {
  orderId: string;
  orderItem: OrderItemForRow;
  canEdit: boolean;
}

const QUICK_REASONS = ["Pest damage", "Weather", "Rotation gap", "Sold out", "Bolted"];

export function InlineShortageRow({ orderId, orderItem, canEdit }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fulfilledQty, setFulfilledQty] = useState(
    String(orderItem.isShorted ? (orderItem.quantityFulfilled ?? 0) : orderItem.quantityRequested)
  );
  const [reason, setReason] = useState(orderItem.shortageReason ?? "");

  const isShorted = orderItem.isShorted;

  async function saveShortage(opts: { fulfilled: number; reason: string }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/shortage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              order_item_id: orderItem.id,
              quantity_fulfilled: opts.fulfilled,
              shortage_reason: opts.reason || "Supply limitation",
            },
          ],
        }),
      });
      if (res.ok) {
        setExpanded(false);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to save");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function clearShortage() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/shortage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              order_item_id: orderItem.id,
              quantity_fulfilled: orderItem.quantityRequested,
              shortage_reason: null,
              clear: true,
            },
          ],
        }),
      });
      if (res.ok) {
        setExpanded(false);
        router.refresh();
      } else {
        // Fallback: try with quantity = requested (won't be marked shorted)
        const data = await res.json();
        setError(data.error ?? "Failed to clear");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    const fulfilled = parseFloat(fulfilledQty);
    if (!isFinite(fulfilled) || fulfilled < 0) {
      setError("Enter a valid quantity");
      return;
    }
    if (fulfilled >= orderItem.quantityRequested) {
      // Not a shortage — clear instead
      clearShortage();
      return;
    }
    saveShortage({ fulfilled, reason });
  }

  return (
    <div
      className={`border-b border-gray-50 last:border-0 ${isShorted ? "bg-orange-50" : ""}`}
    >
      {/* Main row — tap anywhere to toggle if editable */}
      <button
        type="button"
        onClick={() => canEdit && setExpanded((v) => !v)}
        disabled={!canEdit}
        className={`w-full px-4 py-3 flex items-center gap-3 text-left ${
          canEdit ? "hover:bg-gray-50" : ""
        } transition-colors disabled:cursor-default`}
      >
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              isShorted ? "text-orange-800" : "text-gray-900"
            }`}
          >
            {orderItem.itemName}
          </p>
          {isShorted && orderItem.shortageReason && !expanded && (
            <p className="text-xs text-orange-600 mt-0.5">{orderItem.shortageReason}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <span className="text-xs text-gray-400 mr-1">
            {UNIT_LABELS[orderItem.unitType as keyof typeof UNIT_LABELS] ?? orderItem.unitType}
          </span>
          {isShorted ? (
            <span className="text-sm text-orange-700 font-semibold">
              {formatQty(orderItem.quantityFulfilled ?? 0)}{" "}
              <span className="line-through text-gray-400 font-normal">
                {formatQty(orderItem.quantityRequested)}
              </span>
            </span>
          ) : (
            <span className="text-sm font-semibold text-gray-900">
              {formatQty(orderItem.quantityRequested)}
            </span>
          )}
        </div>
        {canEdit && (
          <AlertTriangle
            className={`w-4 h-4 flex-shrink-0 ${
              isShorted ? "text-orange-500" : "text-gray-300"
            }`}
          />
        )}
      </button>

      {/* Inline editor */}
      {expanded && canEdit && (
        <div className="px-4 pb-3 pt-1 bg-orange-50/40 space-y-2 border-t border-orange-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex-shrink-0">
              Picked:
            </span>
            <input
              type="number"
              min="0"
              max={orderItem.quantityRequested}
              step="0.5"
              value={fulfilledQty}
              onChange={(e) => setFulfilledQty(e.target.value)}
              className="w-20 h-9 px-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
            />
            <span className="text-xs text-gray-500">
              of {formatQty(orderItem.quantityRequested)}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              {orderItem.quantityRequested - parseFloat(fulfilledQty || "0") > 0 &&
                `${formatQty(orderItem.quantityRequested - parseFloat(fulfilledQty || "0"))} short`}
            </span>
          </div>

          {/* Quick reason chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`text-xs min-h-[32px] px-3 py-1.5 rounded-full transition-colors ${
                  reason === r
                    ? "bg-orange-500 text-white"
                    : "bg-white border border-orange-200 text-orange-700 hover:bg-orange-100"
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Or type a reason..."
            className="w-full h-10 px-3 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
          />

          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 min-h-[44px] bg-orange-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {saving ? "Saving..." : "Save"}
            </button>
            {isShorted && (
              <button
                type="button"
                onClick={clearShortage}
                disabled={saving}
                className="min-h-[44px] px-3 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg disabled:opacity-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              disabled={saving}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-50"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
