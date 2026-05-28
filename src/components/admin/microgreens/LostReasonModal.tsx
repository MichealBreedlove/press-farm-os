"use client";
import { useEffect, useState } from "react";

const REASON_CHIPS = [
  "Damping off disease",
  "Mold",
  "Failed germination",
  "Pest damage",
  "Tray contaminated",
];

type Props = {
  open: boolean;
  trayCount: number;          // 1 for single, N for bulk
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export function LostReasonModal({ open, trayCount, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Pick a reason or type one.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Could not mark as lost.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = trayCount === 1 ? "Mark tray as lost" : `Mark ${trayCount} trays as lost`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-farm-muted text-sm px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-farm-muted">Common reasons</p>
          <div className="flex flex-wrap gap-1.5">
            {REASON_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setReason(c)}
                className={
                  reason === c
                    ? "px-2.5 py-1 rounded-full bg-farm-dark text-white text-xs"
                    : "px-2.5 py-1 rounded-full border border-farm-dark/15 text-farm-muted hover:border-farm-dark/30 text-xs"
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="form-label">Reason</span>
          <input
            type="text"
            className="input-field w-full"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Damping off disease"
            autoFocus
          />
        </label>

        {error && (
          <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-farm-muted"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-red-700 text-white font-medium disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Mark as lost"}
          </button>
        </div>
      </div>
    </div>
  );
}
