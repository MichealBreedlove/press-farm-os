"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Pencil, Plus } from "lucide-react";
import { PlantingForm, type Planting } from "./PlantingForm";
import { LIFECYCLE_LABELS, MONTH_ABBR, type PlantingLifecycle } from "@/lib/production-value/constants";

export type EnrichedPlanting = Planting & {
  id: string;
  lifecycle: PlantingLifecycle;
  value_amount: number;
  value_to_date: number;
};

type Activity = { id: string; logged_at: string; note: string; planting_id: string | null };

type Props = {
  boxId: string;
  items: Array<{ id: string; name: string }>;
  plantings: EnrichedPlanting[];
  activity: Activity[];
};

const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

export function BoxDetailClient({ boxId, items, plantings, activity }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  function refresh() {
    setAdding(false);
    setEditingId(null);
    router.refresh();
  }

  async function deletePlanting(id: string) {
    if (!confirm("Delete this planting? Its production value will stop counting.")) return;
    await fetch(`/api/planter-boxes/plantings/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSavingNote(true);
    await fetch("/api/planter-boxes/activity", {
      method: "POST",
      body: JSON.stringify({ box_id: boxId, note }),
    });
    setNote("");
    setSavingNote(false);
    router.refresh();
  }

  async function deleteNote(id: string) {
    await fetch(`/api/planter-boxes/activity?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Plantings */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-pf-serif">Plantings</h2>
          {!adding && (
            <button className="btn-secondary inline-flex items-center gap-1" onClick={() => { setAdding(true); setEditingId(null); }}>
              <Plus className="w-4 h-4" /> Add
            </button>
          )}
        </div>

        {adding && (
          <div className="mb-4">
            <PlantingForm boxId={boxId} items={items} onDone={refresh} onCancel={() => setAdding(false)} />
          </div>
        )}

        {plantings.length === 0 && !adding && (
          <p className="text-sm text-farm-muted">No plantings yet. Add one to start tracking production value.</p>
        )}

        <ul className="space-y-2">
          {plantings.map((p) =>
            editingId === p.id ? (
              <li key={p.id}>
                <PlantingForm boxId={boxId} items={items} initial={p} onDone={refresh} onCancel={() => setEditingId(null)} />
              </li>
            ) : (
              <li key={p.id} className="rounded-lg border border-farm-dark/15 p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-farm-muted">
                    {LIFECYCLE_LABELS[p.lifecycle]} ·{" "}
                    {p.lifecycle === "annual"
                      ? `${money(p.value_amount)} total`
                      : `${money(p.value_amount)}/mo`}
                    {p.lifecycle === "perennial_dormant" && p.seasonal_months?.length
                      ? ` · ${p.seasonal_months.map((m) => MONTH_ABBR[m - 1]).join(" ")}`
                      : ""}
                  </div>
                  <div className="text-xs text-farm-muted">
                    planted {p.planted_date}
                    {p.end_date ? ` · ${p.lifecycle === "annual" ? "ends" : "removed"} ${p.end_date}` : ""}
                    {p.status === "removed" ? " · removed" : ""}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="badge-blue">{money(p.value_to_date)} to date</span>
                  <div className="flex gap-1">
                    <button className="p-1.5 text-farm-muted hover:text-farm-dark" onClick={() => { setEditingId(p.id); setAdding(false); }} aria-label="Edit planting">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-farm-muted hover:text-red-700" onClick={() => deletePlanting(p.id)} aria-label="Delete planting">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      </section>

      {/* Activity log */}
      <section>
        <h2 className="text-lg font-pf-serif mb-3">Activity log</h2>
        <form onSubmit={addNote} className="flex gap-2 mb-3">
          <input className="input-field flex-1" value={note} placeholder="Harvested a flat of nasturtium…"
            onChange={(e) => setNote(e.target.value)} />
          <button className="btn-secondary" disabled={savingNote || !note.trim()}>Log</button>
        </form>
        {activity.length === 0 ? (
          <p className="text-sm text-farm-muted">No activity logged.</p>
        ) : (
          <ul className="space-y-1.5">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 text-sm border-b border-farm-dark/5 pb-1.5">
                <div>
                  <span className="text-farm-muted tabular-nums mr-2">{a.logged_at}</span>
                  {a.note}
                </div>
                <button className="text-farm-muted hover:text-red-700 shrink-0" onClick={() => deleteNote(a.id)} aria-label="Delete entry">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
