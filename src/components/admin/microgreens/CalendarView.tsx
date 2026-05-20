"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { MicrogreenBatch } from "@/types/database";

type Event =
  | { kind: "sow"; date: string; label: string; href: string }
  | { kind: "blackout-end"; date: string; label: string; href: string }
  | { kind: "harvest"; date: string; label: string; href: string };

const KIND_COLOR: Record<Event["kind"], string> = {
  sow: "bg-blue-500/15 text-blue-800",
  "blackout-end": "bg-amber-400/15 text-amber-800",
  harvest: "bg-farm-green/15 text-farm-green",
};

type Props = {
  batches: Array<MicrogreenBatch & { crop?: { name: string } | null }>;
};

export function CalendarView({ batches }: Props) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  const events = useMemo<Event[]>(() => {
    const out: Event[] = [];
    for (const b of batches) {
      const name = b.crop?.name ?? "?";
      out.push({
        kind: "sow", date: b.sow_date,
        label: `Sow ${b.tray_count}× ${name}`,
        href: `/admin/microgreens/batches/${b.id}`,
      });
      if (b.planned_blackout_end) {
        out.push({
          kind: "blackout-end", date: b.planned_blackout_end,
          label: `Light start: ${name}`,
          href: `/admin/microgreens/batches/${b.id}`,
        });
      }
      out.push({
        kind: "harvest", date: b.planned_harvest_date,
        label: `Harvest ${name}`,
        href: `/admin/microgreens/batches/${b.id}`,
      });
    }
    return out;
  }, [batches]);

  const first = new Date(Date.UTC(month.y, month.m, 1));
  const startDow = first.getUTCDay();
  const start = new Date(first);
  start.setUTCDate(1 - startDow);

  const days: Array<{ iso: string; inMonth: boolean; events: Event[] }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      iso,
      inMonth: d.getUTCMonth() === month.m,
      events: events.filter((e) => e.date === iso),
    });
  }

  function shift(delta: number) {
    setMonth(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  const monthLabel = new Date(Date.UTC(month.y, month.m, 1))
    .toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button className="btn-secondary" onClick={() => shift(-1)}>← Prev</button>
        <h2 className="font-semibold">{monthLabel}</h2>
        <button className="btn-secondary" onClick={() => shift(1)}>Next →</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="p-1 text-center font-medium text-farm-muted">{d}</div>
        ))}
        {days.map((day) => (
          <div
            key={day.iso}
            className={`min-h-[80px] border border-farm-muted/15 p-1 ${day.inMonth ? "bg-white" : "bg-farm-muted/5"}`}
          >
            <div className="text-[10px] text-farm-muted">{day.iso.slice(-2)}</div>
            <div className="space-y-0.5">
              {day.events.map((e, i) => (
                <Link key={i} href={e.href} className={`block px-1 py-0.5 rounded ${KIND_COLOR[e.kind]} text-[10px] truncate`}>
                  {e.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
