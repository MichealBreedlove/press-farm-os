"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  date: string;
  /** Total order_items lines across all restaurants for this date. */
  totalLines: number;
  /** Lines that have either picked_at set OR are marked as shorted (i.e. resolved). */
  resolvedLines: number;
  /** Number of orders currently in 'submitted' state — the bump target. */
  submittedOrderCount: number;
}

/**
 * Sticky bottom action bar on the unified pick page. Tracks pick
 * progress (picked + shorted = resolved) and fires the
 * /api/orders/send-to-receiver flow:
 *   - Bumps every 'submitted' order for this date to 'in_progress'
 *   - Sends the receiver-daily email to active receivers
 *
 * The button is enabled as long as there's at least one submitted
 * order to bump OR resolved lines to communicate. Showing it disabled
 * with a clear reason is preferable to hiding it — admin should
 * always know where the workflow ends.
 */
export function SendToReceiverBar({ date, totalLines, resolvedLines, submittedOrderCount }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; sent: number; bumped: number; receivers: number; failed: number; message?: string }
    | { ok: false; error: string }
    | null
  >(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const progress = totalLines === 0 ? 0 : Math.round((resolvedLines / totalLines) * 100);
  const everythingResolved = totalLines > 0 && resolvedLines === totalLines;
  const canSend = totalLines > 0 && (submittedOrderCount > 0 || resolvedLines > 0);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/orders/send-to-receiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setResult({ ok: false, error: json.error ?? `Failed (${res.status})` });
        return;
      }
      setResult({
        ok: true,
        sent: json.sent ?? 0,
        bumped: json.bumped ?? 0,
        receivers: json.receivers_count ?? 0,
        failed: json.failed ?? 0,
        message: json.message,
      });
      router.refresh();
    } catch (err: any) {
      setResult({ ok: false, error: err?.message ?? "Network error" });
    } finally {
      setSending(false);
      setConfirmOpen(false);
    }
  }

  if (totalLines === 0) return null;

  return (
    <>
      <div
        className="fixed bottom-nav-safe inset-x-0 bg-white border-t border-farm-dark/10 px-4 py-3 z-40 print:hidden"
        style={{ boxShadow: "0 -8px 16px -8px rgba(0, 0, 0, 0.08)" }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1.5">
              <p className="text-sm font-semibold text-farm-dark">
                {resolvedLines}
                <span className="text-farm-muted font-normal">/{totalLines}</span>
              </p>
              <p className="text-[11px] text-farm-muted">
                {everythingResolved ? "all resolved" : "picked or shorted"}
              </p>
            </div>
            <div className="h-1.5 bg-farm-cream/60 rounded-full overflow-hidden">
              <div
                className={`h-full transition-[width] duration-300 ${
                  everythingResolved ? "bg-farm-green" : "bg-pf-master-violet"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={sending || !canSend}
            className="px-4 py-2.5 rounded-lg bg-farm-green text-white text-sm font-semibold hover:bg-farm-green-dark disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 inline-flex items-center gap-1.5"
          >
            {sending ? "Sending…" : "Send to Receiver"}
            {!sending && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[60] bg-farm-dark/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6">
            <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green font-semibold">
              Hand-off
            </p>
            <h2 className="font-display text-xl text-farm-dark mt-1">
              Send today&apos;s orders to the receiver?
            </h2>
            <ul className="mt-3 text-sm text-farm-dark/85 leading-relaxed space-y-1.5 list-disc pl-5">
              <li>{submittedOrderCount} submitted order{submittedOrderCount === 1 ? "" : "s"} will move to <strong>In Progress</strong></li>
              <li>Active receiver(s) will get an email with today&apos;s pick + shortage state</li>
              <li>You can re-send later if anything changes</li>
            </ul>
            {!everythingResolved && (
              <p className="mt-3 text-xs text-pf-master-orange">
                {totalLines - resolvedLines} line{totalLines - resolvedLines === 1 ? "" : "s"} not yet picked or shorted — you can still send and finish later.
              </p>
            )}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={sending}
                className="px-4 min-h-[40px] rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="px-4 min-h-[40px] rounded-lg bg-farm-green text-white text-sm font-semibold hover:bg-farm-green-dark disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-x-0 top-4 z-[70] flex justify-center px-4 print:hidden">
          <div
            className={`max-w-md w-full rounded-xl shadow-lg px-4 py-3 ${
              result.ok
                ? "bg-farm-green/10 border border-farm-green/30 text-farm-green"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {result.ok ? (
                  <>
                    <p className="text-sm font-semibold">
                      {result.message
                        ? result.message
                        : `Sent to ${result.sent} receiver${result.sent === 1 ? "" : "s"}.`}
                    </p>
                    {!result.message && (
                      <p className="text-xs mt-0.5">
                        {result.bumped} order{result.bumped === 1 ? "" : "s"} moved to In Progress
                        {result.failed > 0 ? ` · ${result.failed} email failure${result.failed === 1 ? "" : "s"}` : ""}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm font-semibold">{result.error}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-xs opacity-70 hover:opacity-100 -mr-1"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
