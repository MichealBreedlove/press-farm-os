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
  /** Per-line size label (e.g. "Tiny", "Bronze") if the chef picked one. */
  sizeLabel?: string | null;
  quantityRequested: number;
  quantityFulfilled: number | null;
  isShorted: boolean;
  shortageReason: string | null;
  /** ISO timestamp when admin marked the line picked; null = not yet. */
  pickedAt?: string | null;
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
  // Optimistic local state for the pick checkbox so the tap feels
  // instant while the API round-trip happens. Reverts on error.
  const [pickedLocal, setPickedLocal] = useState<boolean>(Boolean(orderItem.pickedAt));
  const [pickToggling, setPickToggling] = useState(false);

  const isShorted = orderItem.isShorted;
  const isPicked = pickedLocal;

  /**
   * Toggle the picked_at timestamp. Stops event bubbling so tapping the
   * checkbox doesn't also expand the shortage editor.
   */
  async function togglePicked(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canEdit || pickToggling) return;
    const next = !isPicked;
    setPickedLocal(next);
    setPickToggling(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/picked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_item_id: orderItem.id, picked: next }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch {
      setPickedLocal(!next);
    } finally {
      setPickToggling(false);
    }
  }

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
      className={`border-b border-gray-50 last:border-0 ${isShorted ? "bg-pf-master-orange/8" : ""} ${
        isPicked ? "bg-farm-green/5" : ""
      } transition-colors`}
    >
      {/* Main row — tap anywhere to toggle the shortage editor if editable */}
      <button
        type="button"
        onClick={() => canEdit && setExpanded((v) => !v)}
        disabled={!canEdit}
        className={`w-full px-4 py-3 flex items-center gap-3 text-left ${
          canEdit ? "hover:bg-farm-cream/40" : ""
        } transition-colors disabled:cursor-default`}
      >
        {/* Pick checkbox — large 44×44 tap target so it's harvest-glove
            friendly. Stops propagation so it doesn't also open the
            shortage editor. Disabled rendering when canEdit=false. */}
        <span
          role="checkbox"
          aria-checked={isPicked}
          aria-label={isPicked ? "Mark as not picked" : "Mark as picked"}
          tabIndex={canEdit ? 0 : -1}
          onClick={canEdit ? togglePicked : undefined}
          onKeyDown={(e) => {
            if (canEdit && (e.key === " " || e.key === "Enter")) {
              e.preventDefault();
              togglePicked(e as unknown as React.MouseEvent);
            }
          }}
          className={`flex-shrink-0 w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
            isPicked
              ? "bg-farm-green border-farm-green"
              : canEdit
                ? "bg-white border-farm-dark/25 hover:border-farm-green"
                : "bg-farm-cream/40 border-farm-dark/15"
          } ${pickToggling ? "opacity-60" : ""} ${canEdit ? "cursor-pointer" : "cursor-default"}`}
        >
          {isPicked && (
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              isShorted
                ? "text-orange-800"
                : isPicked
                  ? "text-farm-muted line-through"
                  : "text-farm-dark"
            }`}
          >
            {orderItem.itemName}
          </p>
          {isShorted && orderItem.shortageReason && !expanded && (
            <p className="text-xs text-orange-600 mt-0.5">{orderItem.shortageReason}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          {/* Container chip — distinct visual so the harvester can scan
              for "what vessel does this go in" at a glance. Different
              container per item is the norm here, not the exception. */}
          <span className="inline-block px-1.5 py-0.5 mr-2 rounded text-[10px] font-bold uppercase tracking-wider bg-farm-green/15 text-farm-green tabular-nums align-middle">
            {(UNIT_LABELS[orderItem.unitType as keyof typeof UNIT_LABELS] ?? orderItem.unitType ?? "—")
              .toString()
              .toUpperCase()}
          </span>
          {orderItem.sizeLabel && (
            <span className="inline-block px-1.5 py-0.5 mr-2 rounded text-[10px] font-medium bg-farm-cream text-farm-muted align-middle">
              {orderItem.sizeLabel}
            </span>
          )}
          {isShorted ? (
            <span className="text-sm text-pf-master-orange font-semibold">
              {formatQty(orderItem.quantityFulfilled ?? 0)}{" "}
              <span className="line-through text-farm-muted font-normal">
                {formatQty(orderItem.quantityRequested)}
              </span>
            </span>
          ) : (
            <span className="text-sm font-semibold text-farm-dark">
              {formatQty(orderItem.quantityRequested)}
            </span>
          )}
        </div>
        {canEdit && (
          <AlertTriangle
            className={`w-4 h-4 flex-shrink-0 ${
              isShorted ? "text-pf-master-orange" : "text-farm-muted/60"
            }`}
          />
        )}
      </button>

      {/* Inline editor */}
      {expanded && canEdit && (
        <div className="px-4 pb-3 pt-1 bg-pf-master-orange/[0.04] space-y-2 border-t border-pf-master-orange/20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-farm-muted flex-shrink-0">
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
            <span className="text-xs text-farm-muted">
              of {formatQty(orderItem.quantityRequested)}
            </span>
            <span className="text-xs text-farm-muted ml-auto">
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
                    : "bg-white border border-orange-200 text-pf-master-orange hover:bg-orange-100"
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
                className="min-h-[44px] px-3 bg-white border border-farm-dark/10 text-farm-muted/90 text-sm font-medium rounded-lg disabled:opacity-50"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              disabled={saving}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-farm-muted hover:text-farm-muted/90 disabled:opacity-50"
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
