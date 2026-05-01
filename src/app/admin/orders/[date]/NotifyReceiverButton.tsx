"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface InitialLastNotify {
  sentAt: string;
  succeeded: number;
  failed: number;
}

interface Props {
  deliveryDate: string;
  /** Most recent notify event for this date (server-rendered).
   *  Drives the "Last sent X mins ago" caption on the idle button. */
  initialLastNotify?: InitialLastNotify | null;
}

interface Summary {
  delivery_date: string;
  restaurants: number;
  lineCount: number;
  counts: { ready: number; short: number; pending: number; extra: number };
  receiverCount: number;
  /** ISO timestamp of the most recent send for this date, or null if never sent. */
  lastSentAt: string | null;
  lastSendSucceeded: number | null;
  lastSendFailed: number | null;
}

/** Human-readable "X minutes ago" — used for re-send detection. */
function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface NotifyResult {
  delivery_date: string;
  sent_to: number;
  succeeded: number;
  failed: number;
  fulfilled_orders: number;
  results: { receiver: string; status: string; id?: string; error?: any }[];
}

const STATUS_DOT: Record<keyof Summary["counts"], string> = {
  ready:   "bg-farm-green",
  short:   "bg-pf-master-orange",
  pending: "bg-amber-500",
  extra:   "bg-pf-master-blue",
};

/**
 * "Finish & Send to Receiver" — end-of-pick-and-pack action.
 * Three-state UX: idle → confirmation card with summary → success card.
 *
 * The confirmation card fetches GET /api/receiver/notify?format=json so
 * admin sees ready/short/pending/extra counts + receiver count BEFORE
 * the email goes out. Also exposes a toggle to mark all open orders
 * as fulfilled (default on — that's what "Finish" implies).
 */
export function NotifyReceiverButton({ deliveryDate, initialLastNotify }: Props) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<NotifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [markFulfilled, setMarkFulfilled] = useState(true);

  // When the confirmation panel opens, pull a fresh summary
  useEffect(() => {
    if (!confirming) return;
    let cancelled = false;
    async function load() {
      setSummaryLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/receiver/notify?date=${deliveryDate}&format=json`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) {
          if (!res.ok) setError(json.error ?? "Couldn't load preview");
          else setSummary(json);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [confirming, deliveryDate]);

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/receiver/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_date: deliveryDate, mark_fulfilled: markFulfilled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Notify failed");
      setResult(json);
      setConfirming(false);
      // Refresh the page so fulfilled orders + status pills update
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  // Success state
  if (result) {
    return (
      <div className="bg-farm-green-light border border-farm-green/20 rounded-2xl p-4 text-center">
        <p className="text-sm font-semibold text-farm-green">
          ✓ Receiver{result.succeeded === 1 ? "" : "s"} notified
        </p>
        <p className="text-xs text-farm-muted mt-1">
          {result.succeeded} of {result.sent_to} email{result.sent_to === 1 ? "" : "s"} sent
          {result.failed > 0 && ` · ${result.failed} failed`}
          {result.fulfilled_orders > 0 && ` · ${result.fulfilled_orders} order${result.fulfilled_orders === 1 ? "" : "s"} fulfilled`}
        </p>
        <button
          type="button"
          onClick={() => { setResult(null); setError(null); setSummary(null); }}
          className="text-xs text-farm-green underline mt-2 min-h-0"
        >
          Send again
        </button>
      </div>
    );
  }

  // Confirmation state
  if (confirming) {
    return (
      <div className="bg-pf-master-violet/[0.06] border border-pf-master-violet/20 rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-farm-dark">Send today&apos;s receiving summary?</p>
          <p className="text-xs text-farm-muted mt-1 leading-relaxed">
            Every active receiver gets an email with the current state. Re-send any time after.
          </p>
        </div>

        {/* Re-send warning — shown only when this date was already notified
            in the last 24h. Helps prevent accidental double-sends. */}
        {summary?.lastSentAt && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            <p className="font-semibold">
              Already sent {timeAgo(summary.lastSentAt)}
            </p>
            <p className="mt-0.5">
              {summary.lastSendSucceeded ?? 0} succeeded
              {(summary.lastSendFailed ?? 0) > 0 && ` · ${summary.lastSendFailed} failed`} ·
              re-send only if status has changed.
            </p>
          </div>
        )}

        {/* Live count summary so admin sees what's about to go out */}
        {summaryLoading && (
          <p className="text-xs text-farm-muted text-center py-2">Calculating…</p>
        )}

        {summary && (
          <div className="bg-white border border-pf-master-violet/15 rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-4 gap-2 text-center">
              {(["ready", "short", "pending", "extra"] as const).map((s) => (
                <div key={s}>
                  <p className="font-display text-xl text-farm-dark leading-none flex items-center justify-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${STATUS_DOT[s]}`} aria-hidden="true" />
                    {summary.counts[s]}
                  </p>
                  <p className="text-[9px] tracking-[0.18em] uppercase text-farm-muted mt-1">{s}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-farm-muted text-center">
              {summary.lineCount} item{summary.lineCount === 1 ? "" : "s"} across {summary.restaurants} restaurant{summary.restaurants === 1 ? "" : "s"}
              {summary.receiverCount > 0
                ? ` · ${summary.receiverCount} receiver${summary.receiverCount === 1 ? "" : "s"}`
                : " · ⚠ no receivers configured"}
            </p>
          </div>
        )}

        {summary && summary.receiverCount === 0 && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            No active receivers exist yet.{" "}
            <a href="/admin/settings/users" className="underline font-medium">Invite a receiver</a> first.
          </div>
        )}

        {/* Fulfill toggle — default on */}
        <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-pf-master-violet/10 cursor-pointer">
          <div>
            <p className="text-sm font-medium text-farm-dark">Also mark orders as fulfilled</p>
            <p className="text-xs text-farm-muted mt-0.5">
              Closes pick-and-pack — orders move from In Progress to Fulfilled.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMarkFulfilled((v) => !v)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${markFulfilled ? "bg-pf-master-violet" : "bg-gray-300"}`}
            aria-pressed={markFulfilled}
            aria-label="Mark orders fulfilled"
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${markFulfilled ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setConfirming(false); setSummary(null); setError(null); }}
            className="flex-1 min-h-[44px] rounded-xl border border-farm-dark/15 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || (summary?.receiverCount === 0)}
            className="flex-1 min-h-[44px] rounded-xl bg-pf-master-violet text-white text-sm font-semibold disabled:opacity-40 hover:bg-pf-master-violet/90"
          >
            {sending ? "Sending…" : "Send Now"}
          </button>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  // Idle state
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
          Closes orders + emails the receiver with shortages and extras.
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
      {/* Inline "last sent" caption — pulled in from the server-side log
          query. Surfaces accidental double-sends without the admin having
          to open the confirmation panel. */}
      {initialLastNotify && (
        <p className="text-[11px] text-amber-700 text-center">
          Last sent {timeAgo(initialLastNotify.sentAt)}
          {" — "}
          {initialLastNotify.succeeded} succeeded
          {initialLastNotify.failed > 0 && ` · ${initialLastNotify.failed} failed`}
        </p>
      )}
    </div>
  );
}
