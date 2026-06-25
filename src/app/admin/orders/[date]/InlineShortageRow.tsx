"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, X, Repeat } from "lucide-react";
import { formatQty } from "@/lib/utils";
import { UNIT_LABELS } from "@/lib/constants";

interface OrderItemForRow {
  id: string;
  itemName: string;
  category: string;
  unitType: string;
  /** Per-line size label (e.g. "Tiny", "Bronze") if the chef picked one. */
  sizeLabel?: string | null;
  /** Comma-separated variety/color the chef picked (e.g. "Chocolate, Spearmint"). */
  colorKey?: string | null;
  /** True when this line was ordered under the Events Menu (vs Regular). */
  isEvent?: boolean;
  quantityRequested: number;
  quantityFulfilled: number | null;
  isShorted: boolean;
  shortageReason: string | null;
  /** ISO timestamp when admin marked the line picked; null = not yet. */
  pickedAt?: string | null;
  /** Substitution — what was sent in place of this shorted line, if any. */
  replacementItemId?: string | null;
  replacementLabel?: string | null;
  replacementQuantity?: number | null;
  replacementUnit?: string | null;
}

/** Lightweight catalog entry for the replacement picker. */
export interface ReplacementOption {
  id: string;
  name: string;
  unit_type: string;
}

interface Props {
  orderId: string;
  orderItem: OrderItemForRow;
  canEdit: boolean;
  /** Full non-archived catalog so admin can pick a substitute for a shorted line. */
  catalogItems: ReplacementOption[];
}

const QUICK_REASONS = ["Pest damage", "Weather", "Rotation gap", "Sold out", "Bolted"];

export function InlineShortageRow({ orderId, orderItem, canEdit, catalogItems }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fulfilledQty, setFulfilledQty] = useState(
    String(orderItem.isShorted ? (orderItem.quantityFulfilled ?? 0) : orderItem.quantityRequested)
  );
  const [reason, setReason] = useState(orderItem.shortageReason ?? "");
  // Substitution state — what was sent instead of this shorted item.
  const [replItemId, setReplItemId] = useState<string | null>(orderItem.replacementItemId ?? null);
  const [replLabel, setReplLabel] = useState(orderItem.replacementLabel ?? "");
  const [replUnit, setReplUnit] = useState(orderItem.replacementUnit ?? "");
  const [replQty, setReplQty] = useState(
    orderItem.replacementQuantity != null ? String(orderItem.replacementQuantity) : ""
  );
  const [replSearch, setReplSearch] = useState("");

  const replMatches = useMemo(() => {
    const q = replSearch.toLowerCase().trim();
    if (!q) return [];
    return catalogItems
      .filter((i) => i.name.toLowerCase().includes(q) && i.id !== replItemId)
      .slice(0, 8);
  }, [replSearch, catalogItems, replItemId]);

  function pickReplacement(item: ReplacementOption) {
    setReplItemId(item.id);
    setReplLabel(item.name);
    // Default the unit to the item's first declared container so the chef
    // sees "Miracle (2 BU)" rather than a bare number.
    const firstUnit = item.unit_type.split(",").map((u) => u.trim()).filter(Boolean)[0];
    setReplUnit(firstUnit ?? "");
    setReplSearch("");
  }

  function clearReplacement() {
    setReplItemId(null);
    setReplLabel("");
    setReplUnit("");
    setReplQty("");
    setReplSearch("");
  }
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
              replacement: replLabel.trim()
                ? {
                    item_id: replItemId,
                    label: replLabel.trim(),
                    quantity: replQty.trim() && isFinite(parseFloat(replQty))
                      ? parseFloat(replQty)
                      : null,
                    unit: replUnit.trim() || null,
                  }
                : null,
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
        clearReplacement();
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

  /**
   * Pick a shortage reason. On a not-yet-shorted line a reason signals intent
   * to short, so if the picked qty is still the full requested amount we drop
   * it to 0 — that way a quick "tap item → tap reason → Save" records a full
   * shortage instead of silently clearing (fulfilled === requested reads as
   * "fully picked"). A qty the admin already lowered for a partial shortage is
   * left untouched.
   */
  function selectReason(r: string) {
    setReason(r);
    if (!isShorted) {
      const current = parseFloat(fulfilledQty);
      if (!isFinite(current) || current >= orderItem.quantityRequested) {
        setFulfilledQty("0");
      }
    }
  }

  function handleSave() {
    const fulfilled = parseFloat(fulfilledQty);
    if (!isFinite(fulfilled) || fulfilled < 0) {
      setError("Enter a valid quantity");
      return;
    }
    if (fulfilled >= orderItem.quantityRequested) {
      // Picked qty meets/exceeds the request, so there's no shortage to record.
      if (reason.trim()) {
        // A reason was given — the admin means to short this line but hasn't
        // lowered the quantity. Guide them rather than silently clearing.
        setError(
          `Lower the picked quantity below ${formatQty(orderItem.quantityRequested)} to record this shortage.`
        );
        return;
      }
      // No reason + full qty — nothing to short; clear any existing shortage.
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
            {orderItem.isEvent && (
              <span className="ml-1.5 align-middle text-[9px] tracking-wider uppercase bg-pf-master-violet/[0.12] text-pf-master-violet px-1.5 py-0.5 rounded font-semibold">
                Events
              </span>
            )}
          </p>
          {orderItem.colorKey && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {orderItem.colorKey.split(",").map((c) => c.trim()).filter(Boolean).map((c) => (
                <span
                  key={c}
                  className="text-[10px] bg-pf-master-violet/[0.08] text-pf-master-violet px-2 py-0.5 rounded-full"
                >
                  {c}
                </span>
              ))}
            </div>
          )}
          {isShorted && orderItem.shortageReason && !expanded && (
            <p className="text-xs text-orange-600 mt-0.5">{orderItem.shortageReason}</p>
          )}
          {isShorted && orderItem.replacementLabel && !expanded && (
            <p className="text-xs text-farm-green font-medium mt-0.5 flex items-center gap-1">
              <Repeat className="w-3 h-3 flex-shrink-0" />
              Sent instead: {orderItem.replacementLabel}
              {orderItem.replacementQuantity != null && (
                <span className="text-farm-muted font-normal">
                  ({formatQty(orderItem.replacementQuantity)}
                  {orderItem.replacementUnit ? ` ${orderItem.replacementUnit.toUpperCase()}` : ""})
                </span>
              )}
            </p>
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
                onClick={() => selectReason(r)}
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

          {/* Substitution — what was sent instead. The chef's shortage email
              surfaces this so they know what landed in place of the shorted
              item. Optional: leave blank for a plain shortage. */}
          <div className="pt-1 border-t border-orange-200/60">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Repeat className="w-3.5 h-3.5 text-farm-green" />
              <span className="text-xs font-medium text-farm-dark">Replaced with</span>
              <span className="text-[10px] text-farm-muted">optional</span>
            </div>

            {replLabel ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 bg-farm-green/8 border border-farm-green/25 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-farm-dark flex-1 truncate">{replLabel}</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    value={replQty}
                    onChange={(e) => setReplQty(e.target.value)}
                    placeholder="Qty"
                    className="w-14 h-8 px-2 border border-farm-green/30 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-farm-green"
                  />
                  {replUnit && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-farm-green">
                      {replUnit}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearReplacement}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-farm-muted hover:text-red-600"
                  aria-label="Remove replacement"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="search"
                  value={replSearch}
                  onChange={(e) => setReplSearch(e.target.value)}
                  placeholder="Search a substitute item…"
                  className="w-full h-10 px-3 border border-farm-green/30 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-farm-green bg-white"
                />
                {replMatches.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-farm-dark/10 bg-white shadow-lg divide-y divide-farm-dark/5">
                    {replMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => pickReplacement(item)}
                        className="w-full px-3 py-2 text-left text-sm text-farm-dark hover:bg-farm-cream/50 min-h-[40px] flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="text-[10px] text-farm-muted uppercase tracking-wider flex-shrink-0">
                          {item.unit_type.split(",").map((u) => u.trim().toUpperCase()).join(" · ")}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

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
