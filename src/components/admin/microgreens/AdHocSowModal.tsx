"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { todayPacific } from "@/lib/utils";

type Crop = {
  id: string;
  name: string;
  variety: string | null;
  blackout_days: number;
  ideal_harvest_day: number;
};

interface Props {
  crops: Crop[];
  onClose: () => void;
}

function todayIso() {
  return todayPacific();
}

export function AdHocSowModal({ crops, onClose }: Props) {
  const router = useRouter();
  const [cropId, setCropId] = useState("");
  const [sowDate, setSowDate] = useState(todayIso());
  const [trayCount, setTrayCount] = useState(1);
  const [seedLot, setSeedLot] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const sortedCrops = useMemo(
    () =>
      [...crops].sort((a, b) => {
        const an = `${a.name} ${a.variety ?? ""}`.toLowerCase();
        const bn = `${b.name} ${b.variety ?? ""}`.toLowerCase();
        return an.localeCompare(bn);
      }),
    [crops],
  );

  const selectedCrop = sortedCrops.find((c) => c.id === cropId);
  const projectedHarvest = useMemo(() => {
    if (!selectedCrop || !sowDate) return null;
    const d = new Date(sowDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + selectedCrop.ideal_harvest_day);
    return d.toISOString().slice(0, 10);
  }, [selectedCrop, sowDate]);

  async function submit() {
    setError(null);
    if (!cropId) { setError("Pick a crop"); return; }
    if (!sowDate) { setError("Sow date required"); return; }
    if (!Number.isFinite(trayCount) || trayCount < 1) { setError("Tray count must be ≥ 1"); return; }

    start(async () => {
      const res = await fetch("/api/microgreens/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop_id: cropId,
          sow_date: sowDate,
          tray_count: trayCount,
          seed_lot: seedLot || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Sow failed");
        return;
      }
      onClose();
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-farm-dark/10 flex items-center justify-between">
          <h3 className="font-display text-lg text-farm-dark">Sow ad-hoc</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-farm-muted text-xl leading-none min-w-[32px] min-h-[32px]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && (
            <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </p>
          )}

          <label className="block">
            <span className="form-label">Crop</span>
            <select
              value={cropId}
              onChange={(e) => setCropId(e.target.value)}
              className="input-field"
              autoFocus
            >
              <option value="">Select a crop…</option>
              {sortedCrops.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.variety ? ` — ${c.variety}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="form-label">Sow date</span>
              <input
                type="date"
                value={sowDate}
                onChange={(e) => setSowDate(e.target.value)}
                className="input-field"
              />
            </label>
            <label className="block">
              <span className="form-label">Trays</span>
              <input
                type="number"
                min="1"
                step="1"
                value={trayCount}
                onChange={(e) => setTrayCount(Number(e.target.value))}
                className="input-field"
              />
            </label>
          </div>

          {selectedCrop && projectedHarvest && (
            <p className="text-xs text-farm-muted leading-relaxed">
              Blackout {selectedCrop.blackout_days} d · projected harvest{" "}
              <span className="text-farm-dark font-medium">{projectedHarvest}</span>{" "}
              (day {selectedCrop.ideal_harvest_day})
            </p>
          )}

          <label className="block">
            <span className="form-label">Seed lot (optional)</span>
            <input
              type="text"
              value={seedLot}
              onChange={(e) => setSeedLot(e.target.value)}
              className="input-field"
              placeholder="Supplier + lot number"
            />
          </label>

          <label className="block">
            <span className="form-label">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="input-field"
              placeholder="Tray location, observations…"
            />
          </label>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="flex-1 px-4 py-3 rounded-lg bg-farm-green text-white font-medium text-sm min-h-[44px] disabled:opacity-60"
            >
              {isPending ? "Sowing…" : "Confirm sow"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-3 rounded-lg border border-farm-dark/20 text-farm-muted text-sm min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
