/**
 * Admin calendar — server data layer. Admin client only; never import into
 * a client component. Every query is bounded to one month.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getCalendarEvents } from "@/lib/forecasting";
import { buildCalendarMonth, monthRange } from "./compute";
import type { CalendarMonth, CalendarRawRows } from "./types";

export async function getCalendarMonth(year: number, month: number): Promise<CalendarMonth> {
  const admin = createAdminClient() as any;
  const { from, to } = monthRange(year, month);

  const [
    { data: deliveryDates },
    { data: orders },
    { data: deliveries },
    { data: notifyRows },
    { data: tasks },
    { data: notes },
    { data: eventRequests },
    { data: labor },
    { data: restaurantRows },
    harvest,
  ] = await Promise.all([
    admin
      .from("delivery_dates")
      .select("id, date, day_of_week, ordering_open")
      .gte("date", from)
      .lte("date", to),
    admin
      .from("orders")
      .select(
        "id, delivery_date, status, event_name, event_date, restaurant:restaurants(name), order_items(id, is_shorted)",
      )
      .gte("delivery_date", from)
      .lte("delivery_date", to),
    admin
      .from("deliveries")
      .select("id, delivery_date, status, total_value, restaurants(name), delivery_items(id)")
      .gte("delivery_date", from)
      .lte("delivery_date", to),
    admin
      .from("receiver_notify_log")
      .select("delivery_date")
      .gte("delivery_date", from)
      .lte("delivery_date", to),
    // Tolerant: migration 062 may be missing → error → treated as [].
    admin
      .from("farm_tasks")
      .select(
        "id, title, type, source, priority, status, due_date, due_time, item_id, microgreen_crop_id",
      )
      .in("status", ["open", "completed", "snoozed"])
      .gte("due_date", from)
      .lte("due_date", to)
      .limit(500),
    admin
      .from("farm_notes")
      .select("id, date, text, category")
      .gte("date", from)
      .lte("date", to)
      .order("created_at", { ascending: true })
      .limit(300),
    admin
      .from("event_requests")
      .select(
        "id, needed_by_date, event_name, quantity, unit, status, item:items(name), restaurant:restaurants(name)",
      )
      .gte("needed_by_date", from)
      .lte("needed_by_date", to)
      .limit(300),
    admin
      .from("labor_entries")
      .select("date, hours, worker_name")
      .gte("date", from)
      .lte("date", to)
      .limit(500),
    admin.from("restaurants").select("name").order("name", { ascending: true }),
    getCalendarEvents(from, to).catch(() => []),
  ]);

  // "Published?" per delivery date via head-counts — one tiny request per
  // date (≤14/month). A month-wide row fetch would blow the 1,000-row cap.
  const publishedDates: string[] = (
    await Promise.all(
      ((deliveryDates ?? []) as Array<{ date: string }>).map(async (d) => {
        const { count } = await admin
          .from("availability_items")
          .select("id", { count: "exact", head: true })
          .eq("delivery_date", d.date);
        return (count ?? 0) > 0 ? d.date : null;
      }),
    )
  ).filter((d): d is string => d !== null);

  // Task linkage names (no N+1: one IN query each).
  const taskRows = (tasks ?? []) as CalendarRawRows["tasks"];
  const itemIds = Array.from(new Set(taskRows.map((t) => t.item_id).filter(Boolean))) as string[];
  const cropIds = Array.from(
    new Set(taskRows.map((t) => t.microgreen_crop_id).filter(Boolean)),
  ) as string[];
  const [taskItemNames, taskCropNames] = await Promise.all([
    itemIds.length
      ? admin
          .from("items")
          .select("id, name")
          .in("id", itemIds)
          .then(({ data }: any) =>
            Object.fromEntries((data ?? []).map((r: any) => [r.id, r.name])) as Record<string, string>,
          )
      : Promise.resolve({} as Record<string, string>),
    cropIds.length
      ? admin
          .from("microgreen_crops")
          .select("id, name")
          .in("id", cropIds)
          .then(({ data }: any) =>
            Object.fromEntries((data ?? []).map((r: any) => [r.id, r.name])) as Record<string, string>,
          )
      : Promise.resolve({} as Record<string, string>),
  ]);

  const rows: CalendarRawRows = {
    deliveryDates: deliveryDates ?? [],
    orders: orders ?? [],
    deliveries: deliveries ?? [],
    notifyRows: notifyRows ?? [],
    publishedDates,
    tasks: taskRows,
    taskItemNames,
    taskCropNames,
    notes: notes ?? [],
    eventRequests: eventRequests ?? [],
    labor: labor ?? [],
    harvest,
    restaurants: ((restaurantRows ?? []) as Array<{ name: string }>).map((r) => r.name),
  };

  return buildCalendarMonth(year, month, rows);
}
