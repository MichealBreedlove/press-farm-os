"use client";

import { useState, useTransition } from "react";

interface Props {
  seedId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function LogGermTestModal({ seedId, onClose, onSuccess }: Props) {
  const [pending, startTransition] = useTransition();
  const [pct, setPct] = useState("");
  const [testedOn, setTestedOn] = useState(new Date().toISOString().slice(0, 10));
  const [seedsTested, setSeedsTested] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const pctNum = parseFloat(pct);
    if (!Number.isFinite(pctNum) || pctNum < 0 || pctNum > 100) {
      setError("Germination % must be between 0 and 100");
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/seeds/${seedId}/germ-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          germination_pct: pctNum,
          tested_on: testedOn,
          seeds_tested: seedsTested ? Number(seedsTested) : undefined,
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
    <div
      className="fixed inset-0 z-40 bg-farm-dark/40 flex items-end sm:items-center justify-center px-3 py-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-farm-dark/10 flex items-center justify-between">
          <h3 className="font-display text-lg text-farm-dark">Log germination test</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-farm-muted text-xl leading-none min-w-[32px] min-h-[32px]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">
          <form onSubmit={submit} className="space-y-3">
            {error && (
              <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                {error}
              </p>
            )}
            <label className="block">
              <span className="form-label">Germination %</span>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                required
                autoFocus
                className="input-field"
                placeholder="e.g. 85"
              />
            </label>
            <label className="block">
              <span className="form-label">Tested on</span>
              <input
                type="date"
                value={testedOn}
                onChange={(e) => setTestedOn(e.target.value)}
                required
                className="input-field"
              />
            </label>
            <label className="block">
              <span className="form-label">Seeds tested (optional)</span>
              <input
                type="number"
                step="1"
                min="0"
                value={seedsTested}
                onChange={(e) => setSeedsTested(e.target.value)}
                className="input-field"
                placeholder="e.g. 20"
              />
            </label>
            <label className="block">
              <span className="form-label">Notes</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="input-field"
                placeholder="Paper towel method, soil, etc."
              />
            </label>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 px-4 py-3 rounded-lg bg-farm-green text-white font-medium text-sm min-h-[44px] disabled:opacity-60"
              >
                {pending ? "Saving…" : "Log test"}
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
        </div>
      </div>
    </div>
  );
}
