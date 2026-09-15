"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  dayHasActivity,
  monthKey,
  monthTotals,
  parseMonthKey,
  shiftMonth,
} from "@/lib/calendar";
import type { CalendarDay, CalendarLayer, CalendarMonth } from "@/lib/calendar";
import { cn, formatDateShort } from "@/lib/utils";
import { LAYER_META, LAYER_STORAGE_KEY } from "./layers";
import { DayPanel } from "./DayPanel";

interface Props {
  initialMonth: CalendarMonth;
  todayIso: string;
  /** Pre-selected day (from ?date=) so deep links open the panel. */
  initialDate: string | null;
}

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

const COUNT_NOUNS: Record<CalendarLayer, [string, string]> = {
  orders: ["order", "orders"],
  deliveries: ["delivery", "deliveries"],
  tasks: ["task", "tasks"],
  harvest: ["harvest", "harvest"],
  events: ["event", "events"],
  notes: ["note", "notes"],
  labor: ["labor", "labor"],
};

function layerCountLabel(layer: CalendarLayer, n: number): string {
  const [one, many] = COUNT_NOUNS[layer];
  return `${n} ${n === 1 ? one : many}`;
}
const DEFAULT_LAYERS: CalendarLayer[] = ["orders", "deliveries", "tasks", "harvest", "events"];
const SWIPE_MIN_PX = 56;

/**
 * Interactive admin calendar.
 *
 *  - Month paging is client-side against GET /api/calendar (adjacent months
 *    are prefetched, so ‹ › and swipe feel instant; no page reload).
 *  - Layers (orders / deliveries / tasks / harvest / events / notes / labor)
 *    toggle from the chip row and persist in localStorage.
 *  - Tapping a day opens the DayPanel: everything on that date plus quick
 *    actions (open/close ordering, complete/snooze tasks, add task, add note,
 *    jump to availability / orders / delivery log). Mutations refetch the
 *    month in place.
 *  - URL stays in sync (?year=&month=&date=) via history.replaceState so a
 *    refresh or a shared link lands on the same view without an RSC round-trip.
 */
export function CalendarClient({ initialMonth, todayIso, initialDate }: Props) {
  const [months, setMonths] = useState<Record<string, CalendarMonth>>({
    [initialMonth.key]: initialMonth,
  });
  const [current, setCurrent] = useState({ year: initialMonth.year, month: initialMonth.month });
  const [selected, setSelected] = useState<string | null>(initialDate);
  const [layers, setLayers] = useState<Set<CalendarLayer>>(() => new Set(DEFAULT_LAYERS));
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<Set<string>>(new Set());
  // Mirror of `months` for the cache check inside fetchMonth, so the
  // callback stays stable and still sees what's already loaded.
  const monthsRef = useRef(months);
  monthsRef.current = months;
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const key = monthKey(current.year, current.month);
  const monthData = months[key];

  // ── Layer persistence ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAYER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((l): l is CalendarLayer =>
            LAYER_META.some((m) => m.key === l),
          );
          if (valid.length > 0) setLayers(new Set(valid));
        }
      }
    } catch {
      // localStorage unavailable — defaults stand
    }
  }, []);

  const toggleLayer = (layer: CalendarLayer) => {
    setLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) next.delete(layer);
      else next.add(layer);
      try {
        window.localStorage.setItem(LAYER_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // ── Data loading ─────────────────────────────────────────────────────
  const fetchMonth = useCallback(
    async (year: number, month: number, opts: { force?: boolean } = {}) => {
      const k = monthKey(year, month);
      if (!opts.force && (monthsRef.current[k] || inflight.current.has(k))) return;
      inflight.current.add(k);
      try {
        const res = await fetch(`/api/calendar?year=${year}&month=${month}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as CalendarMonth;
        setMonths((prev) => ({ ...prev, [data.key]: data }));
        setError(null);
      } catch (err) {
        console.error("[CALENDAR] fetch failed", err);
        setError("Couldn't load that month. Check your connection and try again.");
      } finally {
        inflight.current.delete(k);
      }
    },
    [],
  );

  // Load the visible month if it isn't cached, and warm the neighbours.
  useEffect(() => {
    if (!months[key]) {
      setLoadingKey(key);
      fetchMonth(current.year, current.month).finally(() => setLoadingKey(null));
    }
    const prev = shiftMonth(current.year, current.month, -1);
    const next = shiftMonth(current.year, current.month, 1);
    fetchMonth(prev.year, prev.month);
    fetchMonth(next.year, next.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, current.year, current.month, fetchMonth]);

  const refreshMonth = useCallback(
    (iso?: string) => {
      const target = iso ? parseMonthKey(iso) : current;
      return fetchMonth(target.year, target.month, { force: true });
    },
    [current, fetchMonth],
  );

  // ── URL sync (no RSC round-trip) ─────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("year", String(current.year));
    params.set("month", String(current.month));
    if (selected) params.set("date", selected);
    const next = `${window.location.pathname}?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [current.year, current.month, selected]);

  // ── Navigation ───────────────────────────────────────────────────────
  const goTo = (year: number, month: number) => {
    setCurrent({ year, month });
    // Keep the selection only if it's inside the new month.
    setSelected((s) => (s && s.startsWith(monthKey(year, month)) ? s : null));
  };
  const goPrev = () => {
    const p = shiftMonth(current.year, current.month, -1);
    goTo(p.year, p.month);
  };
  const goNext = () => {
    const n = shiftMonth(current.year, current.month, 1);
    goTo(n.year, n.month);
  };
  const goToday = () => {
    const t = parseMonthKey(todayIso);
    setCurrent({ year: t.year, month: t.month });
    setSelected(todayIso);
  };

  const selectDay = (iso: string) => {
    setSelected((s) => (s === iso ? null : iso));
    // On phones the panel sits under the grid — bring it into view.
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      window.setTimeout(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 30);
    }
  };

  // Swipe left/right on the grid to page months.
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dy) > Math.abs(dx)) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  // Keyboard: ← → page months, T jumps to today, Esc closes the panel.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "ArrowLeft") goPrev();
    else if (e.key === "ArrowRight") goNext();
    else if (e.key === "t" || e.key === "T") goToday();
    else if (e.key === "Escape") setSelected(null);
  };

  // ── Derived ──────────────────────────────────────────────────────────
  const monthLabel = new Date(current.year, current.month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const isCurrentMonth = todayIso.startsWith(key);
  const totals = useMemo(() => (monthData ? monthTotals(monthData) : null), [monthData]);

  const cells = useMemo(() => {
    const firstDay = new Date(current.year, current.month - 1, 1).getDay();
    const daysInMonth = new Date(current.year, current.month, 0).getDate();
    const out: Array<{ key: string; iso: string | null }> = [];
    for (let i = 0; i < firstDay; i++) out.push({ key: `pad-${i}`, iso: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${key}-${String(d).padStart(2, "0")}`;
      out.push({ key: iso, iso });
    }
    return out;
  }, [current.year, current.month, key]);

  // Agenda: days with activity under the active layers, today-forward when
  // viewing the current month (past days are one tap away in the grid).
  const agenda = useMemo(() => {
    if (!monthData) return [];
    return Object.values(monthData.days)
      .filter((d) => dayHasActivity(d, layers))
      .filter((d) => !isCurrentMonth || d.date >= todayIso)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [monthData, layers, isCurrentMonth, todayIso]);

  const selectedDay: CalendarDay | null =
    selected && monthData
      ? monthData.days[selected] ?? {
          date: selected,
          deliveryDate: null,
          availabilityPublished: false,
          notified: false,
          orders: [],
          deliveries: [],
          tasks: [],
          notes: [],
          eventRequests: [],
          harvest: [],
          labor: null,
        }
      : null;

  const layerCountsForMonth = useMemo(() => {
    const counts: Record<CalendarLayer, number> = {
      orders: 0,
      deliveries: 0,
      tasks: 0,
      harvest: 0,
      events: 0,
      notes: 0,
      labor: 0,
    };
    if (!monthData) return counts;
    for (const day of Object.values(monthData.days)) {
      for (const m of LAYER_META) counts[m.key] += m.count(day);
    }
    return counts;
  }, [monthData]);

  const isLoading = loadingKey === key && !monthData;

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:items-start">
      <div className="space-y-4 min-w-0" onKeyDown={onKeyDown}>
        {/* Month strip */}
        {totals && (
          <p className="text-xs text-farm-muted leading-relaxed">
            <span className="font-medium text-farm-dark">{monthLabel}</span>
            {" · "}
            {totals.orders} order{totals.orders === 1 ? "" : "s"}
            {totals.pendingOrders > 0 && ` (${totals.pendingOrders} pending)`}
            {" · "}
            {totals.deliveries} deliver{totals.deliveries === 1 ? "y" : "ies"}
            {totals.deliveryTotal > 0 && ` · $${totals.deliveryTotal.toFixed(0)}`}
            {totals.openTasks > 0 && ` · ${totals.openTasks} open task${totals.openTasks === 1 ? "" : "s"}`}
            {totals.laborHours > 0 && ` · ${totals.laborHours}h labor`}
          </p>
        )}

        {/* Layer chips — act as both filter and legend */}
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar" role="group" aria-label="Calendar layers">
          {LAYER_META.map((m) => {
            const on = layers.has(m.key);
            const n = layerCountsForMonth[m.key];
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleLayer(m.key)}
                aria-pressed={on}
                className={cn(
                  "flex-shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[36px] text-[11px] font-medium transition-colors",
                  on
                    ? "bg-white border-farm-dark/15 text-farm-dark shadow-sm"
                    : "bg-transparent border-farm-dark/10 text-farm-muted/70",
                )}
              >
                <span className={cn("inline-block w-2 h-2 rounded-full", on ? m.dot : "bg-farm-muted/30")} />
                {m.label}
                {n > 0 && (
                  <span className={cn("tabular-nums", on ? "text-farm-muted" : "text-farm-muted/50")}>{n}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <div
          className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm overflow-hidden select-none"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex items-center justify-between px-2 py-2 border-b border-farm-dark/5 bg-farm-cream/40">
            <button
              type="button"
              onClick={goPrev}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-farm-muted hover:text-farm-dark rounded-xl"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={2} />
            </button>
            <div className="text-center flex items-center gap-2">
              <p className="font-display text-lg text-farm-dark leading-none">{monthLabel}</p>
              {loadingKey === key && (
                <Loader2 className="w-3.5 h-3.5 text-farm-muted animate-spin" aria-label="Loading" />
              )}
              {!isCurrentMonth && (
                <button
                  type="button"
                  onClick={goToday}
                  className="text-[10px] tracking-[0.18em] uppercase text-farm-green hover:underline min-h-[32px] px-1"
                >
                  Today
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={goNext}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-farm-muted hover:text-farm-dark rounded-xl"
              aria-label="Next month"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-farm-dark/5">
            {DAY_HEADERS.map((label, i) => (
              <div
                key={i}
                className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold text-center py-2"
              >
                {label}
              </div>
            ))}
          </div>

          <div className={cn("grid grid-cols-7 transition-opacity", isLoading && "opacity-40")} role="grid">
            {cells.map((cell) => {
              if (!cell.iso) {
                return (
                  <div
                    key={cell.key}
                    className="min-h-[56px] sm:min-h-[76px] border-r border-b border-farm-dark/5 last:border-r-0 bg-farm-cream/20"
                  />
                );
              }
              const iso = cell.iso;
              const day = monthData?.days[iso];
              const dayNum = Number(iso.slice(8, 10));
              const isToday = iso === todayIso;
              const isSelected = iso === selected;
              const isDelivery = Boolean(day?.deliveryDate);
              const isPast = iso < todayIso;
              const visibleLayers = LAYER_META.filter((m) => layers.has(m.key) && day && m.count(day) > 0);
              const overdueTasks =
                day && layers.has("tasks") && isPast
                  ? day.tasks.filter((t) => t.status === "open").length
                  : 0;

              return (
                <button
                  key={cell.key}
                  type="button"
                  onClick={() => selectDay(iso)}
                  aria-pressed={isSelected}
                  aria-label={`${formatDateShort(iso)}${isDelivery ? ", delivery day" : ""}`}
                  className={cn(
                    "relative min-h-[56px] sm:min-h-[76px] border-r border-b border-farm-dark/5 last:border-r-0 p-1 sm:p-1.5 flex flex-col items-stretch gap-0.5 text-left transition-colors",
                    "hover:bg-farm-cream/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-farm-green/50",
                    isSelected && "bg-farm-green/5 ring-2 ring-inset ring-farm-green/60",
                    !isSelected && isToday && "bg-farm-cream/40",
                    isDelivery && !isSelected && "bg-farm-green/[0.03]",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs leading-none inline-flex items-center justify-center w-6 h-6 rounded-full",
                        isToday && "bg-farm-green text-white font-bold",
                        !isToday && isDelivery && "font-semibold text-farm-dark ring-1 ring-farm-green/40",
                        !isToday && !isDelivery && "text-farm-muted/80",
                      )}
                    >
                      {dayNum}
                    </span>
                    {isDelivery && day?.deliveryDate && !day.deliveryDate.orderingOpen && !isPast && (
                      <span
                        className="text-[9px] leading-none text-red-700 font-semibold"
                        title="Ordering closed"
                        aria-label="Ordering closed"
                      >
                        ●
                      </span>
                    )}
                  </span>

                  {/* Mobile: dots. sm+: chips with counts. */}
                  <span className="mt-auto flex flex-wrap gap-0.5 sm:hidden">
                    {overdueTasks > 0 && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600" title={`${overdueTasks} overdue`} />
                    )}
                    {visibleLayers.map((m) => (
                      <span key={m.key} className={cn("inline-block w-1.5 h-1.5 rounded-full", m.dot)} title={m.label} />
                    ))}
                  </span>
                  <span className="mt-auto hidden sm:flex flex-col gap-0.5">
                    {overdueTasks > 0 && (
                      <span className="px-1 py-0.5 rounded text-[9px] leading-tight bg-red-50 text-red-700 truncate">
                        {overdueTasks} overdue
                      </span>
                    )}
                    {visibleLayers.slice(0, overdueTasks > 0 ? 2 : 3).map((m) => {
                      const n = day ? m.count(day) : 0;
                      const label =
                        m.key === "labor" && day?.labor ? `${day.labor.hours}h labor` : layerCountLabel(m.key, n);
                      return (
                        <span key={m.key} className={cn("px-1 py-0.5 rounded text-[9px] leading-tight truncate", m.chip)}>
                          {label}
                        </span>
                      );
                    })}
                    {visibleLayers.length > (overdueTasks > 0 ? 2 : 3) && (
                      <span className="text-[9px] text-farm-muted leading-none pl-1">
                        +{visibleLayers.length - (overdueTasks > 0 ? 2 : 3)}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-farm-dark/5 bg-farm-cream/30 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-farm-muted uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex w-4 h-4 rounded-full ring-1 ring-farm-green/40" /> Delivery day
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-red-700 leading-none">●</span> Ordering closed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600" /> Overdue task
            </span>
            <span className="ml-auto normal-case tracking-normal hidden sm:inline">Swipe or ← → to change month · T for today</span>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => refreshMonth()}
              className="text-xs font-semibold underline min-h-[32px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Agenda — the readable version of the grid for a phone */}
        <section>
          <h3 className="text-[11px] tracking-[0.18em] uppercase text-farm-muted font-semibold mb-2">
            {isCurrentMonth ? "Coming up this month" : `Agenda · ${monthLabel}`}
          </h3>
          {agenda.length === 0 ? (
            <p className="text-sm text-farm-muted/80 italic px-1">
              {monthData ? "Nothing on the active layers." : "Loading…"}
            </p>
          ) : (
            <ul className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm divide-y divide-farm-dark/5 overflow-hidden">
              {agenda.map((d) => {
                const chips = LAYER_META.filter((m) => layers.has(m.key) && m.count(d) > 0);
                const isToday = d.date === todayIso;
                return (
                  <li key={d.date}>
                    <button
                      type="button"
                      onClick={() => selectDay(d.date)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-start gap-3 min-h-[52px] hover:bg-farm-cream/40 transition-colors",
                        selected === d.date && "bg-farm-green/5",
                      )}
                    >
                      <span className="w-[74px] flex-shrink-0">
                        <span className={cn("block text-xs font-medium", isToday ? "text-farm-green" : "text-farm-dark")}>
                          {formatDateShort(d.date)}
                        </span>
                        {d.deliveryDate && (
                          <span className="block text-[10px] text-farm-muted uppercase tracking-wider mt-0.5">
                            {d.deliveryDate.orderingOpen ? "Delivery" : "Closed"}
                          </span>
                        )}
                      </span>
                      <span className="flex flex-wrap gap-1 min-w-0">
                        {chips.map((m) => {
                          const n = m.count(d);
                          const text =
                            m.key === "labor" && d.labor
                              ? `${d.labor.hours}h · ${d.labor.workers.join(", ")}`
                              : m.key === "orders"
                                ? d.orders.map((o) => o.restaurant).join(", ")
                                : m.key === "deliveries"
                                  ? `$${d.deliveries.reduce((s, x) => s + x.total, 0).toFixed(0)} · ${d.deliveries.map((x) => x.restaurant).join(", ")}`
                                  : m.key === "tasks"
                                    ? d.tasks.filter((t) => t.status !== "completed").map((t) => t.title).slice(0, 2).join(" · ") + (n > 2 ? ` +${n - 2}` : "")
                                    : m.key === "harvest"
                                      ? d.harvest.map((h) => h.name).slice(0, 3).join(", ") + (n > 3 ? ` +${n - 3}` : "")
                                      : m.key === "events"
                                        ? d.eventRequests.map((e) => e.eventName ?? e.itemName).slice(0, 2).join(", ")
                                        : `${n} note${n === 1 ? "" : "s"}`;
                          return (
                            <span
                              key={m.key}
                              className={cn("px-1.5 py-0.5 rounded text-[11px] leading-tight max-w-full truncate", m.chip)}
                            >
                              {text}
                            </span>
                          );
                        })}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Day panel: side column on desktop, under the grid on a phone */}
      <div ref={panelRef} className="mt-6 lg:mt-0 lg:sticky lg:top-4 scroll-mt-4">
        {selectedDay ? (
          <DayPanel
            key={selectedDay.date}
            day={selectedDay}
            todayIso={todayIso}
            layers={layers}
            onClose={() => setSelected(null)}
            onChanged={() => refreshMonth(selectedDay.date)}
          />
        ) : (
          <div className="hidden lg:flex bg-white/60 rounded-2xl border border-dashed border-farm-dark/10 min-h-[160px] items-center justify-center text-sm text-farm-muted px-6 text-center">
            Tap a day to see everything on it and act without leaving the calendar.
          </div>
        )}
      </div>
    </div>
  );
}
