"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOW_LABELS } from "@/lib/microgreens/constants";
import { YIELD_UNITS, YIELD_UNIT_LABELS, type YieldUnit } from "@/lib/microgreens/types";
import type { MicrogreenCrop, MicrogreenDemand } from "@/types/database";

type Restaurant = { id: string; name: string };

type Props = {
  crops: MicrogreenCrop[];
  restaurants: Restaurant[];
  demand: MicrogreenDemand[];
};

type EditingCell = {
  crop_id: string;
  restaurant_id: string | null;
  dow: number;
  cropName: string;
  context: string; // for modal title
};

export function DemandGrid({ crops, restaurants, demand }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditingCell | null>(null);

  function rowsFor(crop_id: string, restaurant_id: string | null, dow: number) {
    return demand.filter(
      (d) =>
        d.crop_id === crop_id &&
        (d.restaurant_id ?? null) === restaurant_id &&
        d.day_of_week === dow,
    );
  }

  function summarizeCell(rows: MicrogreenDemand[]): string {
    const byUnit = new Map<string, number>();
    for (const r of rows) {
      const u = r.target_unit;
      const q = Number(r.target_quantity ?? 0);
      if (!u || q <= 0) continue;
      byUnit.set(u, (byUnit.get(u) ?? 0) + q);
    }
    if (byUnit.size === 0) return "—";
    return Array.from(byUnit.entries())
      .map(([u, q]) => `${q} ${YIELD_UNIT_LABELS[u as YieldUnit] ?? u.toUpperCase()}`)
      .join(" · ");
  }

  const columns: Array<{ restaurant: Restaurant | null; dow: number; label: string }> = [];
  for (const r of restaurants) {
    for (const dow of [1, 4, 6]) {
      columns.push({ restaurant: r, dow, label: `${r.name} ${DOW_LABELS[dow]}` });
    }
  }
  for (const dow of [1, 4, 6]) {
    columns.push({ restaurant: null, dow, label: `Farm-wide ${DOW_LABELS[dow]}` });
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="text-left p-2">Crop</th>
            {columns.map((c, i) => (
              <th key={i} className="p-2 text-xs whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crops.map((c) => (
            <tr key={c.id} className="border-t border-farm-muted/15">
              <td className="p-2 font-medium whitespace-nowrap">{c.name}</td>
              {columns.map((col, i) => {
                const rows = rowsFor(c.id, col.restaurant?.id ?? null, col.dow);
                const summary = summarizeCell(rows);
                return (
                  <td key={i} className="p-1 text-center">
                    <button
                      className="px-2 py-1 hover:bg-farm-green/10 rounded min-w-[3rem] whitespace-nowrap text-xs"
                      onClick={() =>
                        setEditing({
                          crop_id: c.id,
                          restaurant_id: col.restaurant?.id ?? null,
                          dow: col.dow,
                          cropName: c.name,
                          context: col.label,
                        })
                      }
                    >
                      {summary}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-farm-muted mt-4">
        Click a cell to set per-unit demand (LG / SM / EA / GB) for that crop × restaurant × delivery day.
        Empty cells mean no manual target.
      </p>

      {editing && (
        <CellEditor
          editing={editing}
          existing={rowsFor(editing.crop_id, editing.restaurant_id, editing.dow)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CellEditor({
  editing,
  existing,
  onClose,
  onSaved,
}: {
  editing: EditingCell;
  existing: MicrogreenDemand[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = YIELD_UNITS.reduce<Record<YieldUnit, string>>((acc, u) => {
    const row = existing.find((r) => r.target_unit === u);
    acc[u] = row ? String(row.target_quantity ?? "") : "";
    return acc;
  }, { lg: "", sm: "", ea: "", gb: "" });

  const [values, setValues] = useState<Record<YieldUnit, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const u of YIELD_UNITS) {
        const raw = values[u].trim();
        const n = raw ? Number(raw) : 0;
        const existingRow = existing.find((r) => r.target_unit === u);

        if (!raw || !Number.isFinite(n) || n <= 0) {
          if (existingRow) {
            await fetch(`/api/microgreens/demand/${existingRow.id}`, { method: "DELETE" });
          }
        } else if (existingRow) {
          await fetch(`/api/microgreens/demand/${existingRow.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target_quantity: n, target_unit: u }),
          });
        } else {
          await fetch("/api/microgreens/demand", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              crop_id: editing.crop_id,
              restaurant_id: editing.restaurant_id,
              day_of_week: editing.dow,
              target_quantity: n,
              target_unit: u,
            }),
          });
        }
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-3"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-farm-dark/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-wider uppercase text-farm-muted">Demand</p>
            <h3 className="font-display text-base text-farm-dark">
              {editing.cropName} · {editing.context}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-farm-muted text-xl leading-none min-w-[32px] min-h-[32px]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && (
            <p className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              {error}
            </p>
          )}
          <p className="text-xs text-farm-muted leading-relaxed">
            Enter how many of each unit are needed on this delivery day. Leave blank for none.
          </p>
          {YIELD_UNITS.map((u) => (
            <label key={u} className="flex items-center gap-3">
              <span className="w-12 text-sm font-medium text-farm-dark">
                {YIELD_UNIT_LABELS[u]}
              </span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={values[u]}
                onChange={(e) => setValues({ ...values, [u]: e.target.value })}
                className="input-field flex-1"
                placeholder="0"
              />
            </label>
          ))}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-lg bg-farm-green text-white font-medium text-sm min-h-[44px] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-3 rounded-lg border border-farm-dark/20 text-farm-muted text-sm min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
