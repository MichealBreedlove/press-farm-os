import { describe, it, expect } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";
import { acceptEventRequest } from "@/lib/event-requests/accept";

/** Minimal accepted-shape request row. */
function makeRequest(overrides: Record<string, any> = {}) {
  return {
    id: "req-1",
    restaurant_id: "rest-1",
    chef_id: "chef-1",
    item_id: "item-1",
    quantity: 3,
    unit: "ea",
    needed_by_date: "2026-07-09", // a Thursday
    event_name: "Garden Dinner",
    notes: null,
    ...overrides,
  };
}

function seed(item: Record<string, any>) {
  return makeSupabaseMock({
    items: [item],
    event_requests: [{ id: "req-1", status: "pending" }],
  });
}

describe("acceptEventRequest", () => {
  it("creates delivery date, availability, order, and line, then stamps the request", async () => {
    const sb = seed({
      id: "item-1",
      name: "Nasturtium Leaves",
      unit_type: "ea",
      unit_prices: {},
      default_price: 0.4,
      size_prices: {},
    });

    const line = await acceptEventRequest(sb as any, makeRequest(), "admin-1", "See you there");

    expect(line.item_name).toBe("Nasturtium Leaves");
    expect(sb._data.delivery_dates).toHaveLength(1);
    expect(sb._data.delivery_dates[0]).toMatchObject({ date: "2026-07-09", day_of_week: "thursday" });
    expect(sb._data.availability_items).toHaveLength(1);
    expect(sb._data.orders).toHaveLength(1);
    expect(sb._data.orders[0].freeform_notes).toBe("Event: Garden Dinner");
    expect(sb._data.order_items).toHaveLength(1);
    expect(sb._data.order_items[0].unit_price_at_order).toBe(0.4);
    expect(sb._data.event_requests[0]).toMatchObject({
      status: "accepted",
      responded_by: "admin-1",
      admin_response: "See you there",
      order_item_id: line.order_item_id,
    });
  });

  it("prefers unit_prices[unit] over default_price", async () => {
    const sb = seed({
      id: "item-1",
      name: "Squash Blossoms",
      unit_type: "sm,lg",
      unit_prices: { sm: 5, lg: 9 },
      default_price: 7,
      size_prices: {},
    });

    await acceptEventRequest(sb as any, makeRequest({ unit: "lg" }), "admin-1", null);

    expect(sb._data.order_items[0].unit_price_at_order).toBe(9);
    expect(sb._data.order_items[0].unit_type).toBe("lg");
  });

  it("stores a legitimate $0.00 price as 0, not NULL (regression: `|| null` dropped it from revenue)", async () => {
    const sb = seed({
      id: "item-1",
      name: "Comp Garnish",
      unit_type: "ea",
      unit_prices: { ea: 0 },
      default_price: 12,
      size_prices: {},
    });

    await acceptEventRequest(sb as any, makeRequest(), "admin-1", null);

    expect(sb._data.order_items[0].unit_price_at_order).toBe(0);
  });

  it("resolves an unpriced item to 0 (not NULL) so the line stays in revenue rollups", async () => {
    const sb = seed({
      id: "item-1",
      name: "New Item",
      unit_type: "ea",
      unit_prices: {},
      default_price: null,
      size_prices: {},
    });

    await acceptEventRequest(sb as any, makeRequest(), "admin-1", null);

    expect(sb._data.order_items[0].unit_price_at_order).toBe(0);
  });

  it("reuses existing delivery date, availability, and order rows", async () => {
    const sb = makeSupabaseMock({
      items: [{ id: "item-1", name: "Mint", unit_type: "ea", unit_prices: {}, default_price: 2, size_prices: {} }],
      event_requests: [{ id: "req-1", status: "pending" }],
      delivery_dates: [{ id: "dd-1", date: "2026-07-09", ordering_open: true }],
      availability_items: [
        { id: "avail-1", item_id: "item-1", restaurant_id: "rest-1", delivery_date: "2026-07-09" },
      ],
      orders: [{ id: "order-1", restaurant_id: "rest-1", delivery_date: "2026-07-09", status: "submitted" }],
    });

    const line = await acceptEventRequest(sb as any, makeRequest(), "admin-1", null);

    expect(sb._data.delivery_dates).toHaveLength(1);
    expect(sb._data.availability_items).toHaveLength(1);
    expect(sb._data.orders).toHaveLength(1);
    expect(line.order_id).toBe("order-1");
    expect(sb._data.order_items[0]).toMatchObject({
      order_id: "order-1",
      availability_item_id: "avail-1",
      quantity_requested: 3,
    });
  });
});
