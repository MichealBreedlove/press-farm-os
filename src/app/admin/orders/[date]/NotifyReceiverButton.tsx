"use client";

import { useState } from "react";

interface Props {
  deliveryDate: string;
}

interface NotifyResult {
  delivery_date: string;
  sent_to: number;
  succeeded: number;
  failed: number;
  results: { receiver: string; status: string; id?: string; error?: any }[];
}

/**
 * "Finish & Send to Receiver" button — triggers the end-of-pick-and-pack flow.
 * Calls /api/receiver/notify which builds the day's incoming summary by
 * joining orders + deliveries (with current shortages applied) and emails
 * every active receiver.
 */
export function NotifyReceiverButton({ deliveryDate }: Props) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<NotifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/receiver/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_date: deliveryDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Notify failed");
      setResult(json);
      setConfirming(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  // After a successful send: show a small success badge with stats
  if (result) {
    return (
      <div className="bg-farm-green-light border border-farm-green/20 rounded-2xl p-4 text-center">
        <p className="text-sm font-semibold text-farm-green">
          ✓ Receiver{result.succeeded === 1 ? "" : "s"} notified
        </p>
        <p className="text-xs text-farm-muted mt-1">
          {result.succeeded} of {result.sent_to} email{result.sent_to === 1 ? "" : "s"} sent
          {result.failed > 0 && ` · ${result.failed} failed`}
        </p>
        <button
          type="button"
          onClick={() => { setResult(null); setError(null); }}
          className="text-xs text-farm-green underline mt-2 min-h-0"
        >
          Send again
        </button>
      </div>
    );
  }

  // Confirmation step — prevents accidental sends mid-pick
  if (confirming) {
    return (
      <div className="bg-pf-master-violet/[0.06] border border-pf-master-violet/20 rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-farm-dark">Send today&apos;s receiving summary?</p>
          <p className="text-xs text-farm-muted mt-1 leading-relaxed">
            Every active receiver will get an email with the current ready / short / pending /
            extra status for both restaurants. You can re-send if you adjust shortages later.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 min-h-[44px] rounded-xl border border-farm-dark/15 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex-1 min-h-[44px] rounded-xl bg-pf-master-violet text-white text-sm font-semibold disabled:opacity-50 hover:bg-pf-master-violet/90"
          >
            {sending ? "Sending…" : "Send Now"}
          </button>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full min-h-[52px] rounded-xl bg-pf-master-violet text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-pf-master-violet/90 transition-colors shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Finish &amp; Send to Receiver
      </button>
      <div className="flex items-center justify-center gap-3 text-[11px]">
        <p className="text-farm-muted">
          Sends a daily summary with shortages and extras flagged.
        </p>
        <span className="text-farm-muted/40">·</span>
        <a
          href={`/api/receiver/notify?date=${deliveryDate}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-pf-master-violet font-medium hover:underline"
        >
          Preview
        </a>
      </div>
    </div>
  );
}
