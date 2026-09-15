/**
 * Admin calendar — shared data shapes.
 *
 * Everything that crosses the server → client boundary for /admin/calendar
 * (and GET /api/calendar) is declared here so the page, the API route and
 * the client grid all agree on one contract. Plain JSON only — no Dates.
 */

import type { ForecastCalendarEvent } from "@/lib/forecasting";

/** Toggleable layers on the calendar grid + day panel. */
export type CalendarLayer =
  | "orders"
  | "deliveries"
  | "tasks"
  | "harvest"
  | "events"
  | "notes"
  | "labor";

export const CALENDAR_LAYERS: CalendarLayer[] = [
  "orders",
  "deliveries",
  "tasks",
  "harvest",
  "events",
  "notes",
  "labor",
];

export interface CalendarOrder {
  id: string;
  restaurant: string;
  status: string;
  itemCount: number;
  shortedCount: number;
  eventName: string | null;
  eventDate: string | null;
}

export interface CalendarDelivery {
  id: string;
  restaurant: string;
  status: string;
  total: number;
  itemCount: number;
}

export interface CalendarTask {
  id: string;
  title: string;
  type: string;
  source: string;
  priority: number;
  status: string;
  dueTime: string | null;
  linkedName: string | null;
}

export interface CalendarNote {
  id: string;
  text: string;
  category: string;
}

export interface CalendarEventRequest {
  id: string;
  eventName: string | null;
  restaurant: string;
  itemName: string;
  quantity: number;
  unit: string;
  status: string;
}

export interface CalendarLabor {
  hours: number;
  workers: string[];
  entries: number;
}

export interface CalendarDay {
  date: string;
  /** Row from delivery_dates, if this is a scheduled delivery day. */
  deliveryDate: { id: string; orderingOpen: boolean; dayOfWeek: string } | null;
  availabilityPublished: boolean;
  /** Receiver "Finish & Send" went out for this date. */
  notified: boolean;
  orders: CalendarOrder[];
  deliveries: CalendarDelivery[];
  tasks: CalendarTask[];
  notes: CalendarNote[];
  eventRequests: CalendarEventRequest[];
  harvest: ForecastCalendarEvent[];
  labor: CalendarLabor | null;
}

export interface CalendarMonth {
  /** 1-indexed month key, e.g. "2026-09". */
  key: string;
  year: number;
  /** 1-indexed. */
  month: number;
  from: string;
  to: string;
  days: Record<string, CalendarDay>;
  /** Restaurant names in display order, for consistent lane ordering. */
  restaurants: string[];
  generatedAt: string;
}

/** Raw rows the aggregator consumes — kept loose so the fetch layer can pass
 *  Supabase results straight through and tests can hand-build fixtures. */
export interface CalendarRawRows {
  deliveryDates: Array<{ id: string; date: string; day_of_week: string | null; ordering_open: boolean | null }>;
  orders: Array<{
    id: string;
    delivery_date: string;
    status: string;
    event_name: string | null;
    event_date: string | null;
    restaurant: { name: string } | { name: string }[] | null;
    order_items: Array<{ id: string; is_shorted: boolean | null }> | null;
  }>;
  deliveries: Array<{
    id: string;
    delivery_date: string;
    status: string;
    total_value: number | null;
    restaurants: { name: string } | { name: string }[] | null;
    delivery_items: Array<{ id: string }> | null;
  }>;
  notifyRows: Array<{ delivery_date: string }>;
  publishedDates: string[];
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    source: string;
    priority: number;
    status: string;
    due_date: string;
    due_time: string | null;
    item_id: string | null;
    microgreen_crop_id: string | null;
  }>;
  taskItemNames: Record<string, string>;
  taskCropNames: Record<string, string>;
  notes: Array<{ id: string; date: string; text: string; category: string }>;
  eventRequests: Array<{
    id: string;
    needed_by_date: string;
    event_name: string | null;
    quantity: number;
    unit: string;
    status: string;
    item: { name: string } | { name: string }[] | null;
    restaurant: { name: string } | { name: string }[] | null;
  }>;
  labor: Array<{ date: string; hours: number | null; worker_name: string }>;
  harvest: ForecastCalendarEvent[];
  restaurants: string[];
}
