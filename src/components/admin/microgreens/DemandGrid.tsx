"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOW_LABELS } from "@/lib/microgreens/constants";
import type { MicrogreenCrop, MicrogreenDemand } from "@/types/database";

type Restaurant = { id: string; name: string };

type Props = {
  crops: MicrogreenCrop[];
  restaurants: Restaurant[];
  demand: MicrogreenDemand[];
};

export function DemandGrid({ crops, restaurants, demand }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");

  function findCell(crop_id: string, restaurant_id: string | null, dow: number) {
    return demand.find((d) =>
      d.crop_id === crop_id
      && (d.restaurant_id ?? null) === restaurant_id
      && d.day_of_week === dow,
    );
  }

  async function save(crop_id: string, restaurant_id: string | null, dow: number, raw: string) {
    const n = Number(raw);
    const existing = findCell(crop_id, restaurant_id, dow);
    if (!raw || n <= 0) {
      if (existing) {
        await fetch(`/api/microgreens/demand/${existing.id}`, { method: "DELETE" });
      }
    } else if (existing) {
      await fetch(`/api/microgreens/demand/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ target_oz: n }),
      });
    } else {
      await fetch("/api/microgreens/demand", {
        method: "POST",
        body: JSON.stringify({ crop_id, restaurant_id, day_of_week: dow, target_oz: n }),
      });
    }
    setEditing(null);
    router.refresh();
  }

  const columns: Array<{ restaurant: Restaurant | null; dow: number; label: string }> = [];
  for (const r of restaurants) {
    for (const dow of [1, 4, 6]) { // Mon Thu Sat
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
            {columns.map((c, i) => <th key={i} className="p-2 text-xs">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {crops.map((c) => (
            <tr key={c.id} className="border-t border-farm-muted/15">
              <td className="p-2 font-medium">{c.name}</td>
              {columns.map((col, i) => {
                const cellKey = `${c.id}-${col.restaurant?.id ?? "null"}-${col.dow}`;
                const cell = findCell(c.id, col.restaurant?.id ?? null, col.dow);
                const isEditing = editing === cellKey;
                return (
                  <td key={i} className="p-1 text-center">
                    {isEditing ? (
                      <input
                        autoFocus
                        className="input w-16"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={() => save(c.id, col.restaurant?.id ?? null, col.dow, value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            save(c.id, col.restaurant?.id ?? null, col.dow, value);
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                    ) : (
                      <button
                        className="px-2 py-1 hover:bg-farm-green/10 rounded min-w-[2.5rem]"
                        onClick={() => {
                          setEditing(cellKey);
                          setValue(cell ? String(cell.target_oz) : "");
                        }}
                      >
                        {cell ? `${cell.target_oz}` : "—"}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-farm-muted mt-4">
        Click a cell to set the weekly oz target for that crop × restaurant × delivery day.
        Empty means no manual target — the forecast sidebar will be used as a fallback.
      </p>
    </div>
  );
}
