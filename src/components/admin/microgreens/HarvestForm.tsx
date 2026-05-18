"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HarvestTask } from "@/lib/microgreens/types";

export function HarvestForm({
  task, deliveries, onClose,
}: {
  task: HarvestTask;
  deliveries: Array<{ id: string; delivery_date: string; restaurant_name?: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [yieldOz, setYieldOz] = useState<string>("");
  const [deliveryId, setDeliveryId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isPending, start] = useTransition();

  async function submit() {
    if (!yieldOz || Number(yieldOz) <= 0) return;
    start(async () => {
      const res = await fetch("/api/microgreens/harvests", {
        method: "POST",
        body: JSON.stringify({
          tray_id: task.tray.id,
          yield_oz: Number(yieldOz),
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
        <label className="block mt-4">
          <span className="block text-sm">Yield (oz)</span>
          <input type="number" step="0.1" className="input w-full" value={yieldOz}
            onChange={(e) => setYieldOz(e.target.value)} autoFocus />
        </label>
        <label className="block mt-3">
          <span className="block text-sm">Assign to delivery (optional)</span>
          <select className="input w-full" value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
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
          <textarea className="input w-full" rows={2} value={notes}
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
