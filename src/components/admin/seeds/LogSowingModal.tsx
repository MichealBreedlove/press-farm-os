"use client";

import { useMemo, useState, useTransition } from "react";
import { todayPacific } from "@/lib/utils";

interface PlantingOption {
  id: string;
  crop_name: string;
  variety: string | null;
  sow_date: string | null;
  item_id: string | null;
  status: string;
}

interface Props {
  seedId: string;
  itemId: string;
  quantityUnit: string;
  onHand: number;
  plantings: PlantingOption[];
  prefilledPlantingId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogSowingModal({
  seedId,
  itemId,
  quantityUnit,
  onHand,
  plantings,
  prefilledPlantingId,
  onClose,
  onSuccess,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [plantingId, setPlantingId] = useState(prefilledPlantingId ?? "");
  const [sownOn, setSownOn] = useState(todayPacific());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const matchingPlantings = useMemo(
    () => plantings.filter((p) => p.item_id === itemId),
    [plantings, itemId],
  );
  const otherPlantings = useMemo(
    () => plantings.filter((p) => p.item_id !== itemId),
    [plantings, itemId],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amountNum = parseFloat(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Amount must be a positive number");
      return;
    }
    if (amountNum > onHand) {
      setError(`Only ${onHand} ${quantityUnit} on hand`);
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/seeds/${seedId}/sowings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_used: amountNum,
          planting_id: plantingId || undefined,
          sown_on: sownOn,
          notes: notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Save failed");
        return;
      }
      onSuccess();
    });
  }

  return (
    <ModalShell title="Log sowing" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {error && (
          <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </p>
        )}
        <label className="block">
          <span className="form-label">Amount used ({quantityUnit})</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            autoFocus
            className="input-field"
            placeholder={`up to ${onHand}`}
          />
        </label>
        <label className="block">
          <span className="form-label">Date sown</span>
          <input
            type="date"
            value={sownOn}
            onChange={(e) => setSownOn(e.target.value)}
            required
            className="input-field"
          />
        </label>
        <label className="block">
          <span className="form-label">Planting (optional)</span>
          <select
            value={plantingId}
            onChange={(e) => setPlantingId(e.target.value)}
            className="input-field"
          >
            <option value="">— not tied to a planting —</option>
            {matchingPlantings.length > 0 && (
              <optgroup label="Matching crop">
                {matchingPlantings.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.crop_name}{p.variety ? ` (${p.variety})` : ""}
                    {p.sow_date ? ` · ${p.sow_date}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {otherPlantings.length > 0 && (
              <optgroup label="Other plantings">
                {otherPlantings.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.crop_name}{p.variety ? ` (${p.variety})` : ""}
                    {p.sow_date ? ` · ${p.sow_date}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <label className="block">
          <span className="form-label">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input-field"
            placeholder="Tray count, location…"
          />
        </label>
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="flex-1 px-4 py-3 rounded-lg bg-farm-green text-white font-medium text-sm min-h-[44px] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Log sowing"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="px-4 py-3 rounded-lg border border-farm-dark/20 text-farm-muted text-sm min-h-[44px]"
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-40 bg-farm-dark/40 flex items-end sm:items-center justify-center px-3 py-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-farm-dark/10 flex items-center justify-between">
          <h3 className="font-display text-lg text-farm-dark">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-farm-muted text-xl leading-none min-w-[32px] min-h-[32px]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
