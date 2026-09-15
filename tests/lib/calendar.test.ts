import { describe, it, expect } from "vitest";
import {
  buildCalendarMonth,
  dayHasActivity,
  monthRange,
  monthTotals,
  parseMonthKey,
  shiftMonth,
} from "@/lib/calendar";
import type { CalendarRawRows } from "@/lib/calendar";

function emptyRows(over: Partial<CalendarRawRows> = {}): CalendarRawRows {
  return {
    deliveryDates: [],
    orders: [],
    deliveries: [],
    notifyRows: [],
    publishedDates: [],
    tasks: [],
    taskItemNames: {},
    taskCropNames: {},
    notes: [],
    eventRequests: [],
    labor: [],
    eventOrders: [],
    harvest: [],
    restaurants: [],
    ...over,
  };
}

describe("calendar date helpers", () => {
  it("monthRange covers leap Februaries and 31-day months", () => {
    expect(monthRange(2028, 2)).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange(2026, 2)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange(2026, 12)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("shiftMonth wraps across year boundaries in both directions", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 6, -18)).toEqual({ year: 2024, month: 12 });
  });

  it("parseMonthKey accepts YYYY-MM and full ISO dates", () => {
    expect(parseMonthKey("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(parseMonthKey("2026-09-15")).toEqual({ year: 2026, month: 9 });
  });
});

describe("buildCalendarMonth", () => {
  it("folds every source into its day and drops out-of-range rows", () => {
    const m = buildCalendarMonth(
      2026,
      9,
      emptyRows({
        deliveryDates: [
          { id: "dd1", date: "2026-09-17", day_of_week: "thursday", ordering_open: true },
          { id: "ddX", date: "2026-10-01", day_of_week: "thursday", ordering_open: true },
        ],
        orders: [
          {
            id: "o1",
            delivery_date: "2026-09-17",
            status: "submitted",
            event_name: null,
            event_date: null,
            restaurant: { name: "Press" },
            order_items: [{ id: "a", is_shorted: false }, { id: "b", is_shorted: true }],
          },
          {
            id: "o2",
            delivery_date: "2026-09-17",
            status: "fulfilled",
            event_name: "Harvest Dinner",
            event_date: "2026-09-20",
            restaurant: [{ name: "Events" }],
            order_items: null,
          },
        ],
        deliveries: [
          {
            id: "d1",
            delivery_date: "2026-09-17",
            status: "logged",
            total_value: 123.456,
            restaurants: { name: "Press" },
            delivery_items: [{ id: "x" }],
          },
        ],
        notifyRows: [{ delivery_date: "2026-09-17" }],
        publishedDates: ["2026-09-17", "2026-08-31"],
        tasks: [
          {
            id: "t1",
            title: "Sow peas",
            type: "sow",
            source: "manual",
            priority: 1,
            status: "open",
            due_date: "2026-09-17",
            due_time: null,
            item_id: "item1",
            microgreen_crop_id: null,
          },
          {
            id: "t2",
            title: "Harvest radish",
            type: "harvest",
            source: "microgreens-auto",
            priority: 2,
            status: "open",
            due_date: "2026-09-17",
            due_time: "07:00:00",
            item_id: null,
            microgreen_crop_id: "crop1",
          },
        ],
        taskItemNames: { item1: "Sugar Snap Peas" },
        taskCropNames: { crop1: "Radish" },
        notes: [{ id: "n1", date: "2026-09-02", text: "Frost on the low beds", category: "observation" }],
        eventRequests: [
          {
            id: "e1",
            needed_by_date: "2026-09-20",
            event_name: "Harvest Dinner",
            quantity: 40,
            unit: "ea",
            status: "pending",
            item: { name: "Squash Blossoms" },
            restaurant: { name: "Press" },
          },
        ],
        labor: [
          { date: "2026-09-02", hours: 4.25, worker_name: "Ana" },
          { date: "2026-09-02", hours: 3.5, worker_name: "Ana" },
          { date: "2026-09-02", hours: 2, worker_name: "Luis" },
        ],
        eventOrders: [
          {
            id: "eo1",
            event_date: "2026-09-20",
            event_name: "Harvest Dinner",
            delivery_date: "2026-09-17",
            status: "submitted",
            restaurant: { name: "Events" },
            order_items: [{ id: "a" }, { id: "b" }, { id: "c" }],
          },
          {
            id: "eoX",
            event_date: "2026-10-02",
            event_name: "Next month",
            delivery_date: "2026-09-30",
            status: "submitted",
            restaurant: { name: "Events" },
            order_items: [],
          },
        ],
        harvest: [
          {
            date: "2026-09-10",
            source: "field",
            type: "harvest-start",
            label: "Harvest opens: Squash Blossoms",
            name: "Squash Blossoms",
            category: "flowers",
            refId: "p1",
          },
        ],
        restaurants: ["Events", "Press", "Under-Study"],
      }),
    );

    expect(m.key).toBe("2026-09");
    expect(m.from).toBe("2026-09-01");
    expect(m.to).toBe("2026-09-30");
    expect(Object.keys(m.days).sort()).toEqual(["2026-09-02", "2026-09-10", "2026-09-17", "2026-09-20"]);

    const d17 = m.days["2026-09-17"];
    expect(d17.deliveryDate).toEqual({ id: "dd1", orderingOpen: true, dayOfWeek: "thursday" });
    expect(d17.availabilityPublished).toBe(true);
    expect(d17.notified).toBe(true);
    // Orders sorted by restaurant; relation shape may be object or array.
    expect(d17.orders.map((o) => o.restaurant)).toEqual(["Events", "Press"]);
    expect(d17.orders[1]).toMatchObject({ itemCount: 2, shortedCount: 1, status: "submitted" });
    expect(d17.orders[0]).toMatchObject({ itemCount: 0, eventName: "Harvest Dinner", eventDate: "2026-09-20" });
    expect(d17.deliveries[0]).toMatchObject({ restaurant: "Press", total: 123.456, itemCount: 1, status: "logged" });
    // Tasks: priority first, then time; linked names resolved.
    expect(d17.tasks.map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(d17.tasks[0].linkedName).toBe("Sugar Snap Peas");
    expect(d17.tasks[1].linkedName).toBe("Radish");

    const d2 = m.days["2026-09-02"];
    expect(d2.notes).toHaveLength(1);
    expect(d2.labor).toEqual({ hours: 9.75, workers: ["Ana", "Luis"], entries: 3 });

    // Event date 09-20 carries both the legacy chef request and the
    // Events-team order (keyed on event_date, not delivery_date).
    const d20 = m.days["2026-09-20"].eventRequests;
    expect(d20).toHaveLength(2);
    expect(d20.find((e) => e.kind === "request")).toMatchObject({
      itemName: "Squash Blossoms",
      restaurant: "Press",
      quantity: 40,
      unit: "ea",
      deliveryDate: null,
    });
    expect(d20.find((e) => e.kind === "order")).toMatchObject({
      id: "eo1",
      eventName: "Harvest Dinner",
      restaurant: "Events",
      itemName: "3 lines",
      deliveryDate: "2026-09-17",
      status: "submitted",
    });
    // The October event order is dropped even though it delivers in September.
    expect(m.days["2026-09-30"]).toBeUndefined();
    expect(m.days["2026-09-10"].harvest[0].name).toBe("Squash Blossoms");
    expect(m.restaurants).toEqual(["Events", "Press", "Under-Study"]);
  });

  it("monthTotals sums across days and rounds money", () => {
    const m = buildCalendarMonth(
      2026,
      9,
      emptyRows({
        deliveries: [
          { id: "a", delivery_date: "2026-09-03", status: "logged", total_value: 10.005, restaurants: null, delivery_items: [] },
          { id: "b", delivery_date: "2026-09-05", status: "logged", total_value: 0.1, restaurants: null, delivery_items: [] },
        ],
        orders: [
          { id: "o", delivery_date: "2026-09-03", status: "submitted", event_name: null, event_date: null, restaurant: null, order_items: [] },
        ],
        tasks: [
          { id: "t", title: "x", type: "custom", source: "manual", priority: 2, status: "completed", due_date: "2026-09-03", due_time: null, item_id: null, microgreen_crop_id: null },
          { id: "u", title: "y", type: "custom", source: "manual", priority: 2, status: "open", due_date: "2026-09-04", due_time: null, item_id: null, microgreen_crop_id: null },
        ],
        labor: [{ date: "2026-09-03", hours: 1.333, worker_name: "A" }],
      }),
    );
    const t = monthTotals(m);
    expect(t).toMatchObject({ orders: 1, pendingOrders: 1, deliveries: 2, openTasks: 1 });
    expect(t.deliveryTotal).toBeCloseTo(10.11, 2);
    expect(t.laborHours).toBe(1.33);
  });
});

describe("dayHasActivity", () => {
  const m = buildCalendarMonth(
    2026,
    9,
    emptyRows({
      notes: [{ id: "n", date: "2026-09-02", text: "x", category: "general" }],
      deliveryDates: [{ id: "dd", date: "2026-09-03", day_of_week: "thursday", ordering_open: false }],
    }),
  );

  it("respects the active layer set", () => {
    const notesOnly = m.days["2026-09-02"];
    expect(dayHasActivity(notesOnly, new Set(["orders"]))).toBe(false);
    expect(dayHasActivity(notesOnly, new Set(["notes"]))).toBe(true);
  });

  it("always counts a delivery day, and never an unknown day", () => {
    expect(dayHasActivity(m.days["2026-09-03"], new Set())).toBe(true);
    expect(dayHasActivity(undefined, new Set(["orders"]))).toBe(false);
  });
});
