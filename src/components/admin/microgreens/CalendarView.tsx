"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { MicrogreenBatch } from "@/types/database";
import { todayPacific } from "@/lib/utils";

type EventKind =
  | "sow"
  | "soak-end"
  | "light-start"
  | "harvest-open"
  | "harvest-ideal"
  | "harvest-close"
  | "life-end";

type Event = {
  kind: EventKind;
  date: string;
  label: string;
  href: string;
};

const KIND_COLOR: Record<EventKind, string> = {
  sow: "bg-blue-500/15 text-blue-800",
  "soak-end": "bg-sky-400/20 text-sky-900",
  "light-start": "bg-amber-400/15 text-amber-800",
  "harvest-open": "bg-emerald-300/20 text-emerald-900",
  "harvest-ideal": "bg-farm-green/20 text-farm-green",
  "harvest-close": "bg-red-300/20 text-red-800",
  "life-end": "bg-gray-300/30 text-gray-700",
};

type CropMeta = {
  name: string;
  variety: string | null;
  presoak_hours: number;
  presprout_hours: number;
  blackout_days: number;
  ideal_harvest_day: number;
  harvest_min_days: number | null;
  harvest_max_days: number | null;
  is_continuous_harvest: boolean;
  productive_life_days: number | null;
};

type BatchWithCrop = MicrogreenBatch & { crop?: CropMeta | null };

type Props = { batches: BatchWithCrop[] };

const MS_PER_DAY = 24 * 3600 * 1000;

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function cropLabel(c: CropMeta | null | undefined): string {
  if (!c) return "?";
  return c.variety ? `${c.name} — ${c.variety}` : c.name;
}

function buildEvents(batches: BatchWithCrop[]): Event[] {
  const out: Event[] = [];
  for (const b of batches) {
    const c = b.crop;
    const name = cropLabel(c);
    const href = `/admin/microgreens/batches/${b.id}`;
    const trays = `${b.tray_count}×`;

    // Sow event — always
    out.push({
      kind: "sow",
      date: b.sow_date,
      label: `Sow ${trays} ${name}`,
      href,
    });

    // Soak end — only if crop has presoak hours that cross into the next day.
    // Soak rolls into presprout (also hours), and presprout into blackout.
    // We collapse all the sub-day stages and surface the day they end on.
    const preTotalHours = (c?.presoak_hours ?? 0) + (c?.presprout_hours ?? 0);
    if (preTotalHours > 0) {
      const endsOn = addDays(b.sow_date, Math.ceil(preTotalHours / 24));
      if (endsOn !== b.sow_date) {
        const preLabel = c?.presprout_hours
          ? `Presprout end → blackout: ${name}`
          : `Soak end → blackout: ${name}`;
        out.push({ kind: "soak-end", date: endsOn, label: preLabel, href });
      }
    }

    // Light start (= planned_blackout_end). Suppress if blackout_days = 0
    // (e.g. continuous-harvest Nasturtium goes straight to light).
    if (b.planned_blackout_end && (c?.blackout_days ?? 0) > 0) {
      out.push({
        kind: "light-start",
        date: b.planned_blackout_end,
        label: `Light start: ${name}`,
        href,
      });
    }

    // Harvest window open — only emit if distinct from ideal
    if (c?.harvest_min_days != null && c.harvest_min_days !== c.ideal_harvest_day) {
      out.push({
        kind: "harvest-open",
        date: addDays(b.sow_date, c.harvest_min_days),
        label: `Harvest window opens: ${name}`,
        href,
      });
    }

    // Ideal harvest (= planned_harvest_date)
    out.push({
      kind: "harvest-ideal",
      date: b.planned_harvest_date,
      label: `Harvest ideal: ${name}`,
      href,
    });

    // Harvest window close — only emit if distinct from ideal
    if (c?.harvest_max_days != null && c.harvest_max_days !== c.ideal_harvest_day) {
      out.push({
        kind: "harvest-close",
        date: addDays(b.sow_date, c.harvest_max_days),
        label: `Harvest window closes: ${name}`,
        href,
      });
    }

    // Productive life end — continuous-harvest crops only
    if (c?.is_continuous_harvest && c.productive_life_days) {
      out.push({
        kind: "life-end",
        date: addDays(b.sow_date, c.productive_life_days),
        label: `Productive life ends: ${name}`,
        href,
      });
    }
  }
  // Sort within a day by event order so stages read top-to-bottom in flow
  const order: Record<EventKind, number> = {
    sow: 0,
    "soak-end": 1,
    "light-start": 2,
    "harvest-open": 3,
    "harvest-ideal": 4,
    "harvest-close": 5,
    "life-end": 6,
  };
  out.sort((a, b) => order[a.kind] - order[b.kind]);
  return out;
}

export function CalendarView({ batches }: Props) {
  const today = useMemo(() => todayPacific(), []);

  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  const events = useMemo(() => buildEvents(batches), [batches]);

  const first = new Date(Date.UTC(month.y, month.m, 1));
  const startDow = first.getUTCDay();
  const start = new Date(first);
  start.setUTCDate(1 - startDow);

  const days: Array<{ iso: string; inMonth: boolean; isToday: boolean; events: Event[] }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      iso,
      inMonth: d.getUTCMonth() === month.m,
      isToday: iso === today,
      events: events.filter((e) => e.date === iso),
    });
  }

  function shift(delta: number) {
    setMonth(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  function jumpToToday() {
    const d = new Date();
    setMonth({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  }

  const monthLabel = new Date(Date.UTC(month.y, month.m, 1))
    .toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button className="btn-secondary" onClick={() => shift(-1)}>← Prev</button>
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{monthLabel}</h2>
          <button
            type="button"
            onClick={jumpToToday}
            className="text-xs px-2 py-0.5 rounded border border-farm-dark/20 text-farm-muted hover:text-farm-dark"
          >
            Today
          </button>
        </div>
        <button className="btn-secondary" onClick={() => shift(1)}>Next →</button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-farm-muted mb-2">
        <span><span className="inline-block w-2 h-2 rounded-sm bg-blue-500/40 mr-1" />Sow</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-sky-400/40 mr-1" />Soak/presprout end</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-amber-400/40 mr-1" />Light start</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-emerald-300/50 mr-1" />Harvest opens</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-farm-green/40 mr-1" />Ideal harvest</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-red-300/50 mr-1" />Harvest closes</span>
        <span><span className="inline-block w-2 h-2 rounded-sm bg-gray-300/60 mr-1" />Life ends</span>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="p-1 text-center font-medium text-farm-muted">{d}</div>
        ))}
        {days.map((day) => (
          <div
            key={day.iso}
            className={`min-h-[80px] border p-1 ${
              day.isToday
                ? "border-pf-master-gold bg-pf-master-gold/5"
                : "border-farm-muted/15"
            } ${day.inMonth ? (day.isToday ? "" : "bg-white") : "bg-farm-muted/5"}`}
          >
            <div className={`text-[10px] ${day.isToday ? "text-pf-master-gold font-bold" : "text-farm-muted"}`}>
              {day.iso.slice(-2)}
            </div>
            <div className="space-y-0.5">
              {day.events.map((e, i) => (
                <Link
                  key={i}
                  href={e.href}
                  className={`block px-1 py-0.5 rounded ${KIND_COLOR[e.kind]} text-[10px] truncate`}
                  title={e.label}
                >
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
