"use client";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  trayId: string;
  trayLabel: string;
  cropName: string;
  hasItemLink: boolean;
  defaultMonth: string; // YYYY-MM — the month the tray was actually producing
  defaultValue: number | null; // crop.value_per_tray
  onClose: () => void;
  onDone: () => void;
};

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long", year: "numeric", timeZone: "UTC",
  });
}

export function TerminateDistributeModal({
  open, trayId, trayLabel, cropName, hasItemLink, defaultMonth, defaultValue,
  onClose, onDone,
}: Props) {
  const [month, setMonth] = useState(defaultMonth);
  const [value, setValue] = useState(defaultValue != null ? String(defaultValue) : "");
  const [deliveryCount, setDeliveryCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMonth(defaultMonth);
      setValue(defaultValue != null ? String(defaultValue) : "");
      setError(null);
    }
  }, [open, defaultMonth, defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Preview: how many deliveries the chosen month has to spread across.
  useEffect(() => {
    if (!open || !/^\d{4}-\d{2}$/.test(month)) {
      setDeliveryCount(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    fetch(`/api/microgreens/trays/${trayId}/terminate?month=${month}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setDeliveryCount(body.deliveries_count ?? null);
      })
      .catch(() => {
        if (!cancelled) setDeliveryCount(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, month, trayId]);

  if (!open) return null;

  const numValue = Number(value);
  const validValue = value !== "" && Number.isFinite(numValue) && numValue > 0;
  const share =
    validValue && deliveryCount ? Math.floor((numValue / deliveryCount) * 100) / 100 : null;

  async function terminate(body: Record<string, unknown>, failMsg: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/microgreens/trays/${trayId}/terminate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        throw new Error(resBody.error ?? failMsg);
      }
      onClose();
      onDone();
    } catch (e: any) {
      setError(e?.message ?? failMsg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Terminate {trayLabel}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-farm-muted text-sm px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-farm-muted">
          {cropName} is a continuous-harvest crop — its tray value gets spread
          evenly across every delivery in the month it was producing, so the
          income lands in the right period.
        </p>

        {!hasItemLink && (
          <p className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            This crop has no linked catalog item, so its value can&apos;t be
            distributed yet. Link an item on the crop first, or terminate
            without distributing.
          </p>
        )}

        <div className="flex gap-2">
          <label className="block flex-1">
            <span className="form-label">Income month</span>
            <input
              type="month"
              className="input-field w-full"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <label className="block w-32">
            <span className="form-label">Tray value ($)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-field w-full"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
        </div>

        <div className="px-3 py-2 rounded-lg bg-blue-100 text-blue-700 text-sm">
          {previewLoading || deliveryCount == null ? (
            <span>Checking deliveries in {monthLabel(month)}…</span>
          ) : deliveryCount === 0 ? (
            <span>
              No deliveries in {monthLabel(month)} — pick a month that has
              deliveries to distribute into.
            </span>
          ) : (
            <span>
              {monthLabel(month)} has <strong>{deliveryCount}</strong>{" "}
              {deliveryCount === 1 ? "delivery" : "deliveries"}
              {share != null && (
                <>
                  {" "}
                  — {fmtUsd(numValue)} ≈ <strong>{fmtUsd(share)}</strong> each
                </>
              )}
              .
            </span>
          )}
        </div>

        {error && (
          <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => terminate({}, "Could not terminate tray.")}
            className="text-sm text-farm-muted underline underline-offset-2"
            disabled={submitting}
          >
            Terminate without distributing
          </button>
          <div className="flex gap-2">
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
              onClick={() =>
                terminate(
                  { distribute: true, target_month: month, value: numValue },
                  "Could not distribute tray value.",
                )
              }
              disabled={
                submitting || !hasItemLink || !validValue || !deliveryCount
              }
              className="btn-primary text-sm disabled:opacity-50"
            >
              {submitting ? "Working…" : "Terminate & distribute"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
