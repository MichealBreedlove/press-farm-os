"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { YIELD_UNITS, YIELD_UNIT_LABELS, type YieldUnit } from "@/lib/microgreens/types";

interface TrayOption {
  id: string;
  label: string;
  crop: string;
  status: string;
}
interface DeliveryOption {
  id: string;
  delivery_date: string;
  restaurant_name?: string;
}

/**
 * Inline "Log a harvest" on the harvest log page — pick any tray that's
 * under lights or already harvesting, enter the yield, optionally assign a
 * delivery. Same POST the tray page's HarvestForm uses.
 */
export function HarvestLogForm({ trays, deliveries }: { trays: TrayOption[]; deliveries: DeliveryOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [trayId, setTrayId] = useState(trays[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<YieldUnit>("lg");
  const [deliveryId, setDeliveryId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!trayId || !quantity || Number(quantity) <= 0) return;
    setError(null);
    start(async () => {
      const res = await fetch("/api/microgreens/harvests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tray_id: trayId,
          quantity: Number(quantity),
          unit,
          delivery_id: deliveryId || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error ?? "Log failed.");
        return;
      }
      setQuantity("");
      setNotes("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={trays.length === 0}
        className="btn-primary w-full inline-flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
        title={trays.length === 0 ? "No trays are under lights or harvesting" : undefined}
      >
        <Plus className="w-4 h-4" />
        Log a harvest
      </button>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-display text-base text-farm-dark">Log a harvest</h3>
      <label className="block">
        <span className="form-label">Tray</span>
        <select className="input-field" value={trayId} onChange={(e) => setTrayId(e.target.value)}>
          {trays.map((t) => (
            <option key={t.id} value={t.id}>
              {t.crop} · {t.label} ({t.status})
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <label className="block flex-1">
          <span className="form-label">Yield</span>
          <input
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            className="input-field"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
          />
        </label>
        <label className="block w-28">
          <span className="form-label">Unit</span>
          <select className="input-field" value={unit} onChange={(e) => setUnit(e.target.value as YieldUnit)}>
            {YIELD_UNITS.map((u) => (
              <option key={u} value={u}>
                {YIELD_UNIT_LABELS[u]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="form-label">Assign to delivery (optional)</span>
        <select className="input-field" value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
          <option value="">— none —</option>
          {deliveries.map((d) => (
            <option key={d.id} value={d.id}>
              {d.delivery_date}
              {d.restaurant_name ? ` · ${d.restaurant_name}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="form-label">Notes</span>
        <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-primary flex-1" onClick={submit} disabled={pending || !quantity}>
          {pending ? "Logging…" : "Log harvest"}
        </button>
        <button type="button" className="btn-ghost flex-1" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
