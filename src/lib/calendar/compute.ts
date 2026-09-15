/**
 * Admin calendar — pure compute. No I/O, unit-tested in tests/lib/calendar.test.ts.
 */

import type {
  CalendarDay,
  CalendarLayer,
  CalendarMonth,
  CalendarRawRows,
} from "./types";

/** First/last ISO date of a 1-indexed month. */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}` };
}

/** Shift a (year, 1-indexed month) pair by N months, wrapping years. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Parse a "YYYY-MM" key or "YYYY-MM-DD" date into {year, month}. */
export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

function relName(rel: { name: string } | { name: string }[] | null | undefined): string {
  if (!rel) return "";
  if (Array.isArray(rel)) return rel[0]?.name ?? "";
  return rel.name ?? "";
}

function emptyDay(date: string): CalendarDay {
  return {
    date,
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
  };
}

/**
 * Fold raw month rows into one CalendarDay per date. Dates outside
 * [from, to] are dropped so a sloppy query can't leak neighbours in.
 */
export function buildCalendarMonth(
  year: number,
  month: number,
  rows: CalendarRawRows,
  generatedAt: string = new Date().toISOString(),
): CalendarMonth {
  const { from, to } = monthRange(year, month);
  const days: Record<string, CalendarDay> = {};
  const inRange = (d: string | null | undefined): d is string =>
    typeof d === "string" && d >= from && d <= to;
  const ensure = (date: string): CalendarDay => (days[date] ??= emptyDay(date));

  for (const d of rows.deliveryDates) {
    if (!inRange(d.date)) continue;
    ensure(d.date).deliveryDate = {
      id: d.id,
      orderingOpen: Boolean(d.ordering_open),
      dayOfWeek: d.day_of_week ?? "",
    };
  }

  for (const o of rows.orders) {
    if (!inRange(o.delivery_date)) continue;
    const items = o.order_items ?? [];
    ensure(o.delivery_date).orders.push({
      id: o.id,
      restaurant: relName(o.restaurant),
      status: o.status,
      itemCount: items.length,
      shortedCount: items.filter((i) => Boolean(i.is_shorted)).length,
      eventName: o.event_name ?? null,
      eventDate: o.event_date ?? null,
    });
  }

  for (const d of rows.deliveries) {
    if (!inRange(d.delivery_date)) continue;
    ensure(d.delivery_date).deliveries.push({
      id: d.id,
      restaurant: relName(d.restaurants),
      status: d.status,
      total: Number(d.total_value ?? 0),
      itemCount: (d.delivery_items ?? []).length,
    });
  }

  for (const n of rows.notifyRows) {
    if (inRange(n.delivery_date)) ensure(n.delivery_date).notified = true;
  }
  for (const date of rows.publishedDates) {
    if (inRange(date)) ensure(date).availabilityPublished = true;
  }

  for (const t of rows.tasks) {
    if (!inRange(t.due_date)) continue;
    const linkedName =
      (t.item_id && rows.taskItemNames[t.item_id]) ||
      (t.microgreen_crop_id && rows.taskCropNames[t.microgreen_crop_id]) ||
      null;
    ensure(t.due_date).tasks.push({
      id: t.id,
      title: t.title,
      type: t.type,
      source: t.source,
      priority: t.priority,
      status: t.status,
      dueTime: t.due_time,
      linkedName,
    });
  }

  for (const n of rows.notes) {
    if (!inRange(n.date)) continue;
    ensure(n.date).notes.push({ id: n.id, text: n.text, category: n.category });
  }

  for (const e of rows.eventRequests) {
    if (!inRange(e.needed_by_date)) continue;
    ensure(e.needed_by_date).eventRequests.push({
      id: e.id,
      eventName: e.event_name ?? null,
      restaurant: relName(e.restaurant),
      itemName: relName(e.item),
      quantity: Number(e.quantity),
      unit: e.unit,
      status: e.status,
    });
  }

  for (const l of rows.labor) {
    if (!inRange(l.date)) continue;
    const day = ensure(l.date);
    day.labor ??= { hours: 0, workers: [], entries: 0 };
    day.labor.hours += Number(l.hours ?? 0);
    day.labor.entries += 1;
    if (l.worker_name && !day.labor.workers.includes(l.worker_name)) {
      day.labor.workers.push(l.worker_name);
    }
  }

  for (const h of rows.harvest) {
    if (inRange(h.date)) ensure(h.date).harvest.push(h);
  }

  // Deterministic ordering inside each day so the UI is stable across refetches.
  for (const day of Object.values(days)) {
    day.orders.sort((a, b) => a.restaurant.localeCompare(b.restaurant));
    day.deliveries.sort((a, b) => a.restaurant.localeCompare(b.restaurant));
    day.tasks.sort(
      (a, b) =>
        a.priority - b.priority ||
        (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") ||
        a.title.localeCompare(b.title),
    );
    day.harvest.sort((a, b) => a.name.localeCompare(b.name));
    if (day.labor) day.labor.hours = Math.round(day.labor.hours * 100) / 100;
  }

  return {
    key: monthKey(year, month),
    year,
    month,
    from,
    to,
    days,
    restaurants: rows.restaurants,
    generatedAt,
  };
}

/** Does this day have anything to show under the active layers? */
export function dayHasActivity(day: CalendarDay | undefined, layers: ReadonlySet<CalendarLayer>): boolean {
  if (!day) return false;
  if (day.deliveryDate) return true;
  if (layers.has("orders") && day.orders.length > 0) return true;
  if (layers.has("deliveries") && day.deliveries.length > 0) return true;
  if (layers.has("tasks") && day.tasks.length > 0) return true;
  if (layers.has("harvest") && day.harvest.length > 0) return true;
  if (layers.has("events") && day.eventRequests.length > 0) return true;
  if (layers.has("notes") && day.notes.length > 0) return true;
  if (layers.has("labor") && day.labor !== null) return true;
  return false;
}

export interface MonthTotals {
  orders: number;
  pendingOrders: number;
  deliveries: number;
  deliveryTotal: number;
  openTasks: number;
  laborHours: number;
  eventRequests: number;
}

export function monthTotals(m: CalendarMonth): MonthTotals {
  const t: MonthTotals = {
    orders: 0,
    pendingOrders: 0,
    deliveries: 0,
    deliveryTotal: 0,
    openTasks: 0,
    laborHours: 0,
    eventRequests: 0,
  };
  for (const day of Object.values(m.days)) {
    t.orders += day.orders.length;
    t.pendingOrders += day.orders.filter((o) => o.status === "submitted").length;
    t.deliveries += day.deliveries.length;
    t.deliveryTotal += day.deliveries.reduce((s, d) => s + d.total, 0);
    t.openTasks += day.tasks.filter((x) => x.status === "open").length;
    t.laborHours += day.labor?.hours ?? 0;
    t.eventRequests += day.eventRequests.length;
  }
  t.deliveryTotal = Math.round(t.deliveryTotal * 100) / 100;
  t.laborHours = Math.round(t.laborHours * 100) / 100;
  return t;
}
