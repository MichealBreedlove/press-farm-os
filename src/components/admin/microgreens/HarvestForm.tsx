"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HarvestTask } from "@/lib/microgreens/types";
import { YIELD_UNITS, YIELD_UNIT_LABELS, type YieldUnit } from "@/lib/microgreens/types";

export function HarvestForm({
  task, deliveries, onClose,
}: {
  task: HarvestTask;
  deliveries: Array<{ id: string; delivery_date: string; restaurant_name?: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  // Units this crop is actually packed in (from yield_per_tray), falling back
  // to all units so the form is never empty.
  const cropUnits = YIELD_UNITS.filter((u) => (task.crop.yield_per_tray ?? {})[u] != null);
  const unitOptions = cropUnits.length > 0 ? cropUnits : YIELD_UNITS;
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<YieldUnit>(unitOptions[0]);
  const [deliveryId, setDeliveryId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isPending, start] = useTransition();

  async function submit() {
    if (!quantity || Number(quantity) <= 0) return;
    start(async () => {
      const res = await fetch("/api/microgreens/harvests", {
        method: "POST",
        body: JSON.stringify({
          tray_id: task.tray.id,
          quantity: Number(quantity),
          unit,
          delivery_id: deliveryId || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-lg font-semibold">
          Log harvest — {task.tray.tray_label}
        </h2>
        <p className="text-sm text-farm-muted mt-1">
          {task.crop.name} · day {task.days_since_sow}
          {task.kind === "continuous-ongoing" && " · continuous harvest"}
        </p>
        <div className="mt-4 flex gap-2">
          <label className="block flex-1">
            <span className="block text-sm">Yield</span>
            <input type="number" step="0.1" min="0" className="input-field" value={quantity}
              onChange={(e) => setQuantity(e.target.value)} autoFocus />
          </label>
          <label className="block w-28">
            <span className="block text-sm">Unit</span>
            <select className="input-field" value={unit}
              onChange={(e) => setUnit(e.target.value as YieldUnit)}>
              {unitOptions.map((u) => (
                <option key={u} value={u}>{YIELD_UNIT_LABELS[u]}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block mt-3">
          <span className="block text-sm">Assign to delivery (optional)</span>
          <select className="input-field" value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
            <option value="">— none —</option>
            {deliveries.map((d) => (
              <option key={d.id} value={d.id}>
                {d.delivery_date} {d.restaurant_name ? `· ${d.restaurant_name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block mt-3">
          <span className="block text-sm">Notes</span>
          <textarea className="input-field" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" onClick={submit} disabled={isPending}>
            {isPending ? "Logging…" : "Log harvest"}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
