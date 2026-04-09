"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";

interface LaborEntry {
  id: string;
  worker_name: string;
  date: string;
  hours: number;
  hourly_rate: number | null;
  notes: string | null;
}

export function LaborClient({ entries, farmId }: { entries: LaborEntry[]; farmId: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [workerName, setWorkerName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [hours, setHours] = useState("8");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/labor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: farmId,
        worker_name: workerName,
        date,
        hours: parseFloat(hours),
        hourly_rate: hourlyRate ? parseFloat(hourlyRate) : null,
        notes: notes || null,
      }),
    });
    if (res.ok) {
      setWorkerName("");
      setHours("8");
      setHourlyRate("");
      setNotes("");
      setShowForm(false);
      router.refresh();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/labor/${id}`, { method: "DELETE" });
    router.refresh();
  }

  // Group entries by week
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);
  const totalCost = entries.reduce((s, e) => s + e.hours * (e.hourly_rate ?? 0), 0);

  // Unique workers
  const workers = Array.from(new Set(entries.map(e => e.worker_name)));

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-farm-dark">{entries.length}</p>
          <p className="text-xs text-gray-400">Entries</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-farm-green">{totalHours.toFixed(1)}</p>
          <p className="text-xs text-gray-400">Total Hours</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-farm-dark">{workers.length}</p>
          <p className="text-xs text-gray-400">Workers</p>
        </div>
      </div>

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
              <label className="block text-xs font-medium text-gray-500 mb-1">Worker Name</label>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Hours</label>
              <input
                type="number"
                required
                step="0.5"
                min="0.5"
                max="24"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Rate ($/hr)</label>
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was done..."
              className="input-field"
            />
          </div>
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
        <p className="text-center text-gray-400 text-sm py-8">No labor entries yet.</p>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-400 grid grid-cols-[1fr_80px_60px_40px]">
            <span>Worker</span>
            <span>Date</span>
            <span className="text-right">Hours</span>
            <span />
          </div>
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="px-4 py-3 border-b border-gray-50 last:border-0 grid grid-cols-[1fr_80px_60px_40px] items-center"
            >
              <div>
                <p className="text-sm font-medium text-farm-dark">{entry.worker_name}</p>
                {entry.notes && <p className="text-xs text-gray-400 truncate">{entry.notes}</p>}
              </div>
              <span className="text-xs text-gray-500">
                {new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span className="text-sm font-semibold text-farm-green text-right">{entry.hours}h</span>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-gray-300 hover:text-red-500 transition-colors min-h-0 min-w-0 flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
