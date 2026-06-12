"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { todayPacific } from "@/lib/utils";

/**
 * Subtle "order for a different date" affordance below the chef order
 * header. Opens a small modal with a date picker; on confirm, hits
 * /api/order/open-date to idempotently create / unlock the
 * delivery_dates row, then navigates to /order?date=YYYY-MM-DD.
 *
 * Off-schedule dates (anything not Thu / Sat / Mon) get tagged with
 * day_of_week='custom' so the admin dashboard can flag them.
 */
export function PickCustomDateLink({ currentDate }: { currentDate: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const navStarted = useRef(false);

  // Farm-local "today" — UTC flips to tomorrow at 4–5pm Pacific, exactly the
  // evening ordering window, which made the picker grey out today's date.
  const today = todayPacific();

  // /order?date=X is a same-route navigation, so this component instance
  // survives it with its state intact. Close the modal once the transition
  // lands — without this the dialog sat on "Opening…" forever and Cancel
  // was disabled, hard-sticking the chef until a page reload.
  useEffect(() => {
    if (navStarted.current && !isPending) {
      navStarted.current = false;
      setOpen(false);
      setSubmitting(false);
      setDate("");
    }
  }, [isPending]);

  async function confirm() {
    if (!date) {
      setError("Pick a date first.");
      return;
    }
    if (date === currentDate) {
      setError("That's the date you're already on.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/order/open-date", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to open date");
        setSubmitting(false);
        return;
      }
      // Server component will refetch with the new date param. Track the
      // navigation as a transition so the effect above can close the modal
      // when the new page data is actually in.
      navStarted.current = true;
      startTransition(() => {
        router.push(`/order?date=${date}`);
        router.refresh();
      });
    } catch (err: any) {
      setError(err?.message ?? "Network error");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="px-4 pt-3 -mt-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-farm-green font-medium hover:underline inline-flex items-center gap-1"
        >
          <span aria-hidden="true">📅</span>
          Order for a different date
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] bg-farm-dark/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6 space-y-4">
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green font-semibold">
                Off-schedule order
              </p>
              <h2 className="font-display text-xl text-farm-dark mt-1">
                Choose a different date
              </h2>
              <p className="text-xs text-farm-muted mt-2 leading-relaxed">
                Picking a date outside the normal Thu / Sat / Mon schedule will tag the order so Press Farm sees a heads-up on the admin dashboard.
              </p>
            </div>
            <div>
              <label className="form-label">Delivery date</label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
              />
            </div>
            {error && (
              <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                {error}
              </p>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  // Always-available escape hatch — never disable Cancel,
                  // even mid-submit, or a slow request traps the chef.
                  navStarted.current = false;
                  setOpen(false);
                  setError(null);
                  setSubmitting(false);
                }}
                className="px-4 min-h-[40px] rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={submitting || isPending || !date}
                className="px-4 min-h-[40px] rounded-lg bg-farm-green text-white text-sm font-semibold hover:bg-farm-green-dark disabled:opacity-50"
              >
                {submitting || isPending ? "Opening…" : "Switch date"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
