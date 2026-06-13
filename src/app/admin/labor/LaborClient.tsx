"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Send } from "lucide-react";
import { formatCurrencyWhole as fmt } from "@/lib/utils";

interface LaborEntry {
  id: string;
  worker_name: string;
  date: string;
  hours: number;
  hourly_rate: number | null;
  notes: string | null;
  time_in?: string | null;
  lunch_out?: string | null;
  lunch_in?: string | null;
  time_out?: string | null;
}

/**
 * Parse "HH:MM" or "HH:MM:SS" → minutes since midnight, or null on
 * empty/malformed input. Used for the live computed-hours preview while
 * the admin types times into the form.
 */
function parseTimeToMinutes(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Format "13:30:00" or "13:30" → "1:30" (12-hour, no AM/PM, matches the example email). */
function fmtTime(value: string | null | undefined): string {
  if (!value) return "";
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  const h24 = parseInt(m[1], 10);
  const mm = m[2];
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm}`;
}

export function LaborClient({ entries, farmId }: { entries: LaborEntry[]; farmId: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const [workerName, setWorkerName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [timeIn, setTimeIn] = useState("");
  const [lunchOut, setLunchOut] = useState("");
  const [lunchIn, setLunchIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");

  // Live computed hours preview — same math as the server
  const computedHours = (() => {
    const tIn = parseTimeToMinutes(timeIn);
    const tOut = parseTimeToMinutes(timeOut);
    if (tIn == null || tOut == null || tOut <= tIn) return null;
    let lunchMins = 0;
    if (lunchOut && lunchIn) {
      const lOut = parseTimeToMinutes(lunchOut);
      const lIn = parseTimeToMinutes(lunchIn);
      if (lOut == null || lIn == null || lIn <= lOut) return null;
      lunchMins = lIn - lOut;
    }
    return Math.round(((tOut - tIn - lunchMins) / 60) * 100) / 100;
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    const res = await fetch("/api/labor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: farmId,
        worker_name: workerName,
        date,
        time_in: timeIn || null,
        lunch_out: lunchOut || null,
        lunch_in: lunchIn || null,
        time_out: timeOut || null,
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        notes: notes || null,
      }),
    });
    if (res.ok) {
      setWorkerName("");
      setTimeIn("");
      setLunchOut("");
      setLunchIn("");
      setTimeOut("");
      setHourlyRate("");
      setNotes("");
      setShowForm(false);
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setFormError(json.error ?? "Failed to save");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/labor/${id}`, { method: "DELETE" });
    router.refresh();
  }

  // Current week entries (Mon-Sun of the most recent week with data)
  // Date boundaries
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const mondayStr = monday.toISOString().split("T")[0];
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sundayStr = sunday.toISOString().split("T")[0];

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];
  const yearStart = `${today.getFullYear()}-01-01`;
  const yearEnd = `${today.getFullYear()}-12-31`;

  const thisWeekEntries = entries.filter(e => e.date >= mondayStr && e.date <= sundayStr);
  const monthEntries = entries.filter(e => e.date >= monthStart && e.date <= monthEnd);
  const yearEntries = entries.filter(e => e.date >= yearStart && e.date <= yearEnd);

  function totalsFor(rows: LaborEntry[]) {
    const hours = rows.reduce((s, e) => s + e.hours, 0);
    const cost = rows.reduce((s, e) => s + e.hours * (e.hourly_rate ?? 0), 0);
    return { hours, cost };
  }
  const week = totalsFor(thisWeekEntries);
  const month = totalsFor(monthEntries);
  const year = totalsFor(yearEntries);

  // Unique worker names across all entries (for the autocomplete datalist)
  const workers = Array.from(new Set(entries.map(e => e.worker_name)));

  const monthLabel = today.toLocaleDateString("en-US", { month: "short" });

  async function handleSendTimesheet() {
    setSending(true);
    setSent(false);
    const res = await fetch("/api/labor/send-timesheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: mondayStr, entries: thisWeekEntries }),
    });
    if (res.ok) setSent(true);
    else alert("Failed to send — check email settings");
    setSending(false);
  }

  return (
    <div className="space-y-4">
      {/* Summary — week / month / year */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="text-xs text-farm-muted uppercase tracking-wide">This Week</p>
          <p className="text-xl font-bold text-farm-green mt-1">{week.hours.toFixed(1)}h</p>
          {week.cost > 0 && <p className="text-[10px] text-farm-muted mt-0.5">{fmt(week.cost)}</p>}
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-farm-muted uppercase tracking-wide">{monthLabel}</p>
          <p className="text-xl font-bold text-farm-dark mt-1">{month.hours.toFixed(1)}h</p>
          {month.cost > 0 && <p className="text-[10px] text-farm-muted mt-0.5">{fmt(month.cost)}</p>}
        </div>
        <div className="card p-3 text-center">
          <p className="text-xs text-farm-muted uppercase tracking-wide">{today.getFullYear()}</p>
          <p className="text-xl font-bold text-farm-dark mt-1">{year.hours.toFixed(1)}h</p>
          {year.cost > 0 && <p className="text-[10px] text-farm-muted mt-0.5">{fmt(year.cost)}</p>}
        </div>
      </div>

      {/* Send Timesheet */}
      {thisWeekEntries.length > 0 && (
        <button
          onClick={handleSendTimesheet}
          disabled={sending}
          className="w-full card-interactive px-4 py-3 flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-medium text-farm-dark">
              {sent ? "Timesheet Sent" : `Send Timesheet — Week of ${new Date(mondayStr + "T12:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" })}`}
            </p>
            <p className="text-xs text-farm-muted mt-0.5">
              {thisWeekEntries.length} {thisWeekEntries.length === 1 ? "entry" : "entries"} · {thisWeekEntries.reduce((s, e) => s + e.hours, 0)}h total
            </p>
          </div>
          {sent ? (
            <span className="badge-green">Sent</span>
          ) : (
            <Send className="w-4 h-4 text-farm-green" />
          )}
        </button>
      )}

      {/* Add entry button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Log Hours
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3">
          <h3 className="font-display text-sm text-farm-dark">Log Hours</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Worker Name</label>
              <input
                type="text"
                required
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="Name"
                className="input-field"
                list="worker-names"
              />
              <datalist id="worker-names">
                {workers.map(w => <option key={w} value={w} />)}
              </datalist>
            </div>
            <div>
              <label className="form-label">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          {/* Clock times — 2x2 grid of time-of-day inputs. Hours
              computed live from the values; lunch is optional but the
              two lunch fields must be set together. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Time In</label>
              <input
                type="time"
                required
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Lunch Out</label>
              <input
                type="time"
                value={lunchOut}
                onChange={(e) => setLunchOut(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Lunch In</label>
              <input
                type="time"
                value={lunchIn}
                onChange={(e) => setLunchIn(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">Time Out</label>
              <input
                type="time"
                required
                value={timeOut}
                onChange={(e) => setTimeOut(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-farm-cream/40 rounded-xl px-3 py-2.5 flex items-baseline justify-between">
              <span className="text-xs text-farm-muted">Hours</span>
              <span className="text-base font-semibold text-farm-green">
                {computedHours != null ? `${computedHours}h` : "—"}
              </span>
            </div>
            <div>
              <label className="form-label">Rate ($/hr)</label>
              <input
                type="number"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="Optional"
                className="input-field"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was done..."
              className="input-field"
            />
          </div>
          {formError && (
            <p className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
              {formError}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="text-center py-10">
          <img src="/assets/pressfarm/flowers/marigold.png" alt="" aria-hidden="true" className="mx-auto h-24 w-auto mb-4" />
          <h3 className="text-base font-semibold text-farm-dark">Track your hours</h3>
          <p className="text-sm text-farm-muted mt-1.5 max-w-sm mx-auto">
            Log farm work to see weekly totals and pay reports. Tap &ldquo;Log Hours&rdquo; above to add your first entry.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 bg-farm-cream/40 text-xs font-semibold text-farm-muted grid grid-cols-[1fr_60px_44px_44px]">
            <span>Worker</span>
            <span>Date</span>
            <span className="text-right">Hours</span>
            <span />
          </div>
          {entries.map((entry) => {
            // Build the time range — same shape as the timesheet email so
            // what the admin sees in the list reads as a preview of what
            // the supervisor will see.
            const hasTimes = entry.time_in && entry.time_out;
            const range = hasTimes
              ? entry.lunch_out && entry.lunch_in
                ? `${fmtTime(entry.time_in)} - ${fmtTime(entry.lunch_out)}, ${fmtTime(entry.lunch_in)} - ${fmtTime(entry.time_out)}`
                : `${fmtTime(entry.time_in)} - ${fmtTime(entry.time_out)}`
              : null;
            return (
              <div
                key={entry.id}
                className="px-4 py-3 border-b border-gray-50 last:border-0 grid grid-cols-[1fr_60px_56px_44px] items-center gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-farm-dark">{entry.worker_name}</p>
                  {range && (
                    <p className="text-xs text-farm-muted tabular-nums truncate">{range}</p>
                  )}
                  {!range && entry.notes && (
                    <p className="text-xs text-farm-muted truncate">{entry.notes}</p>
                  )}
                </div>
                <span className="text-xs text-farm-muted">
                  {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className="text-sm font-semibold text-farm-green text-right tabular-nums">{entry.hours}h</span>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="text-farm-muted/60 hover:text-red-500 transition-colors min-h-0 min-w-0 flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
