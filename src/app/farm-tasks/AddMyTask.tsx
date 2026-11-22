"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus } from "lucide-react";
import { OWN_TASK_MAX_DAYS_AHEAD, OWN_TASK_MAX_LENGTH, type OwnTaskWhen } from "@/lib/tasks/own";
import { addDaysISO, formatDeliveryDate } from "@/lib/utils";

/**
 * "Add a task for myself" — the Head Farm Hand's only way to create a task.
 * Kept as plain as it can be: one box to type in, Today / Tomorrow / Pick a
 * day (which opens the phone's own calendar), one big button. The task always lands on his own list (the server decides who).
 */
export function AddMyTask({ today }: { today: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState<OwnTaskWhen>("today");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      setAdded(null);
      setError("Type what you need to do first.");
      return;
    }
    if (when === "date" && !date) {
      setAdded(null);
      setError("Pick the day first.");
      return;
    }
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const res = await fetch("/api/tasks/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, when, date }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not save — try again.");
        return;
      }
      // Spanish for the crew's translator — best-effort, never waited on.
      if (json.id) void fetch(`/api/tasks/${json.id}/translate`, { method: "POST" }).catch(() => {});
      setAdded(
        when === "date"
          ? `Added to your list for ${formatDeliveryDate(date)}.`
          : when === "tomorrow"
            ? "Added to your list for tomorrow."
            : "Added to your list for today.",
      );
      setTitle("");
      setWhen("today");
      setDate("");
      router.refresh();
    } catch {
      setError("Could not save — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4 space-y-4" aria-labelledby="add-my-task">
      <label id="add-my-task" htmlFor="my-task-text" className="block text-xl font-semibold text-farm-dark">
        Add a task for myself
      </label>
      <textarea
        id="my-task-text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setError(null);
        }}
        rows={2}
        maxLength={OWN_TASK_MAX_LENGTH}
        placeholder="Type what you need to do"
        autoComplete="off"
        className="w-full rounded-xl border-2 border-farm-dark/20 bg-white px-4 py-3 text-xl text-farm-dark placeholder:text-farm-muted focus:border-farm-green focus:outline-none"
      />

      <fieldset>
        <legend className="text-lg font-semibold text-farm-dark mb-2">When?</legend>
        <div className="grid grid-cols-2 gap-3">
          {(["today", "tomorrow", "date"] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={when === w}
              onClick={() => {
                setWhen(w);
                setError(null);
              }}
              className={`${w === "date" ? "col-span-2 " : ""}min-h-[56px] rounded-xl border-2 text-lg font-semibold transition-colors ${
                when === w
                  ? "bg-farm-green text-white border-farm-green"
                  : "bg-white text-farm-dark border-farm-dark/20"
              }`}
            >
              {w === "today" ? "Today" : w === "tomorrow" ? "Tomorrow" : "Pick another day"}
            </button>
          ))}
        </div>
        {when === "date" && (
          <div className="mt-3">
            <label htmlFor="my-task-date" className="block text-lg font-semibold text-farm-dark mb-2">
              Which day?
            </label>
            <input
              id="my-task-date"
              type="date"
              value={date}
              min={today}
              max={addDaysISO(today, OWN_TASK_MAX_DAYS_AHEAD)}
              onChange={(e) => {
                setDate(e.target.value);
                setError(null);
              }}
              className="w-full min-h-[56px] rounded-xl border-2 border-farm-dark/20 bg-white px-4 text-xl text-farm-dark focus:border-farm-green focus:outline-none"
            />
            {date && <p className="text-lg text-farm-dark mt-2">{formatDeliveryDate(date)}</p>}
          </div>
        )}
      </fieldset>

      <button
        type="submit"
        disabled={busy}
        className="w-full min-h-[64px] rounded-xl bg-farm-green text-white text-xl font-semibold hover:bg-farm-green/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <Plus className="w-6 h-6" aria-hidden="true" /> {busy ? "Saving…" : "Add task"}
      </button>

      {error && (
        <p role="alert" className="text-lg font-medium text-red-700">
          {error}
        </p>
      )}
      {added && (
        <p role="status" className="text-lg font-medium text-farm-green flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 flex-shrink-0" aria-hidden="true" /> {added}
        </p>
      )}
    </form>
  );
}
