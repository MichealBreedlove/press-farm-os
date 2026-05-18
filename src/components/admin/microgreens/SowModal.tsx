"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SowTask } from "@/lib/microgreens/types";

export function SowModal({ task, onClose }: { task: SowTask; onClose: () => void }) {
  const router = useRouter();
  const [trayCount, setTrayCount] = useState(task.trays_to_sow);
  const [seedLot, setSeedLot] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, start] = useTransition();

  async function submit() {
    start(async () => {
      const res = await fetch("/api/microgreens/batches", {
        method: "POST",
        body: JSON.stringify({
          crop_id: task.crop.id,
          sow_date: task.sow_date,
          tray_count: trayCount,
          seed_lot: seedLot || null,
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
          Sow {task.crop.name}{task.crop.variety ? ` — ${task.crop.variety}` : ""}
        </h2>
        <p className="text-sm text-farm-muted mt-1">
          For delivery {task.delivery_date}. Plan: {task.trays_needed} trays needed, {task.trays_in_flight} already in flight.
        </p>
        <label className="block mt-4">
          <span className="block text-sm">Tray count</span>
          <input type="number" className="input w-full" value={trayCount}
            onChange={(e) => setTrayCount(Number(e.target.value))} />
        </label>
        <label className="block mt-3">
          <span className="block text-sm">Seed lot (optional)</span>
          <input className="input w-full" value={seedLot} onChange={(e) => setSeedLot(e.target.value)} />
        </label>
        <label className="block mt-3">
          <span className="block text-sm">Notes</span>
          <textarea className="input w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" onClick={submit} disabled={isPending}>
            {isPending ? "Sowing…" : "Confirm sow"}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
