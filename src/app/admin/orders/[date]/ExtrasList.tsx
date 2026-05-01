"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Extra {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
}

interface Props {
  orderId: string;
  extras: Extra[];
}

/**
 * Inline list of extras (delivery_items not on the original order) added during
 * pick-and-pack. Each row has a small remove button so admin can undo a
 * mis-typed quantity or wrong item without leaving the page.
 *
 * Only renders when there's at least one extra — otherwise the AddExtraRow
 * sits alone below.
 */
export function ExtrasList({ orderId, extras }: Props) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(lineId: string) {
    setRemoving(lineId);
    try {
      const res = await fetch(
        `/api/orders/${orderId}/extras?lineId=${encodeURIComponent(lineId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json?.error ?? "Failed to remove");
        return;
      }
      router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  if (extras.length === 0) return null;

  return (
    <div className="px-4 py-3 border-t border-pf-master-blue/15 bg-pf-master-blue/[0.04]">
      <p className="text-[10px] tracking-[0.18em] uppercase text-pf-master-blue font-semibold mb-2">
        Extras Added · {extras.length}
      </p>
      <ul className="space-y-1.5">
        {extras.map((extra) => (
          <li key={extra.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2 border border-pf-master-blue/10">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-farm-dark truncate">{extra.itemName}</p>
              <p className="text-xs text-farm-muted">
                {extra.quantity} {extra.unit}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(extra.id)}
              disabled={removing === extra.id}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center text-farm-muted hover:text-red-600 disabled:opacity-50 transition-colors"
              aria-label={`Remove ${extra.itemName}`}
              title="Remove this extra"
            >
              {removing === extra.id ? (
                <span className="text-xs">…</span>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
