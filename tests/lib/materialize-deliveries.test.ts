import { describe, it, expect } from "vitest";
import {
  planDeliveryRows,
  summarizeSkips,
  materializeDeliveryItems,
  type MaterializeItem,
  type MaterializeOrder,
  type MaterializeOrderLine,
  type ExistingDelivery,
  type ExistingDeliveryItem,
} from "@/lib/materialize-deliveries";
import { resolveOrderUnitPrice } from "@/lib/pricing";

/**
 * planDeliveryRows is the whole decision layer of the delivery materializer
 * (the financial paper trail behind every close-out). Each rule the module
 * doc lists gets its own fixture here so a regression in any of them fails
 * loudly instead of silently under-reporting revenue.
 */

const DATE = "2026-10-29";
const PRESS = "rest-press";
const EVENTS = "rest-events";

const basil: MaterializeItem & { unit_prices: Record<string, number>; size_prices: Record<string, number> } = {
  id: "item-basil",
  name: "Basil",
  unit_type: "sm,lg",
  default_price: 5,
  unit_prices: { sm: 8, lg: 12 },
  size_prices: { Palm: 1 },
};

let seq = 0;
function line(over: Partial<MaterializeOrderLine> & { item?: MaterializeItem | null } = {}): MaterializeOrderLine {
  const { item = basil, ...rest } = over;
  return {
    id: `oi-${++seq}`,
    quantity_requested: 2,
    quantity_fulfilled: null,
    is_shorted: false,
    unit_type: "lg",
    size_label: null,
    unit_price_at_order: null,
    picked_at: "2026-10-29T10:00:00Z",
    availability_item: item === null ? null : { item },
    ...rest,
  };
}

function order(lines: MaterializeOrderLine[], over: Partial<MaterializeOrder> = {}): MaterializeOrder {
  return { id: `order-${++seq}`, restaurant_id: PRESS, status: "in_progress", order_items: lines, ...over };
}

function plan(
  orders: MaterializeOrder[],
  existingDeliveries: ExistingDelivery[] = [],
  existingDeliveryItems: ExistingDeliveryItem[] = [],
  assumeFulfilledOrderIds?: string[],
) {
  return planDeliveryRows({ date: DATE, orders, existingDeliveries, existingDeliveryItems, assumeFulfilledOrderIds });
}

const reasons = (p: ReturnType<typeof plan>) => p.skipped.map((s) => s.reason);

describe("planDeliveryRows — resolution", () => {
  it("counts picked lines, shorted lines, and every line of a fulfilled order", () => {
    const picked = line();
    const shorted = line({ picked_at: null, is_shorted: true, quantity_fulfilled: 1, size_label: "Palm" });
    const untouched = line({ picked_at: null, size_label: "Dime" });
    const p = plan([order([picked, shorted, untouched])]);
    expect(p.rowsToInsert.map((r) => r.quantity)).toEqual([2, 1]);
    expect(reasons(p)).toEqual(["unresolved"]);

    const fulfilled = plan([order([line({ picked_at: null })], { status: "fulfilled" })]);
    expect(fulfilled.rowsToInsert).toHaveLength(1);
    expect(fulfilled.skipped).toEqual([]);
  });

  it("assumeFulfilledOrderIds resolves an order the DB still shows as in_progress", () => {
    const o = order([line({ picked_at: null })]);
    expect(plan([o]).rowsToInsert).toHaveLength(0);
    expect(plan([o], [], [], [o.id]).rowsToInsert).toHaveLength(1);
  });

  it("never materializes cancelled or draft orders", () => {
    const p = plan([
      order([line()], { status: "cancelled" }),
      order([line()], { status: "draft" }),
    ]);
    expect(p.rowsToInsert).toEqual([]);
    expect(p.deliveriesToCreate).toEqual([]);
    expect(reasons(p)).toEqual(["order_not_open", "order_not_open"]);
  });

  it("creates one delivery per restaurant that has resolved lines and no row yet", () => {
    const p = plan([
      order([line()]),
      order([line({ size_label: "Palm" })]), // same restaurant — still one delivery
      order([line()], { restaurant_id: EVENTS }),
      order([line({ picked_at: null })], { restaurant_id: "rest-nothing-resolved" }),
    ]);
    expect(p.deliveriesToCreate).toEqual([
      { delivery_date: DATE, restaurant_id: PRESS, status: "logged" },
      { delivery_date: DATE, restaurant_id: EVENTS, status: "logged" },
    ]);
    // Rows for not-yet-created deliveries carry a null delivery_id and the
    // restaurant so the wrapper can fill the id in after the insert.
    expect(p.rowsToInsert.every((r) => r.delivery_id === null)).toBe(true);
    expect(p.rowsToInsert.map((r) => r.restaurant_id)).toEqual([PRESS, PRESS, EVENTS]);
  });

  it("uses the existing delivery's id when one exists", () => {
    const p = plan([order([line()])], [{ id: "del-1", restaurant_id: PRESS, status: "logged" }]);
    expect(p.deliveriesToCreate).toEqual([]);
    expect(p.rowsToInsert[0].delivery_id).toBe("del-1");
  });
});

describe("planDeliveryRows — quantity", () => {
  it("shorted lines use quantity_fulfilled, others quantity_requested", () => {
    const p = plan([
      order([
        line({ quantity_requested: 5, quantity_fulfilled: 3, is_shorted: false }),
        line({ quantity_requested: 5, quantity_fulfilled: 3, is_shorted: true, size_label: "A" }),
      ]),
    ]);
    expect(p.rowsToInsert.map((r) => r.quantity)).toEqual([5, 3]);
  });

  it("skips zero / null / negative quantities (a fully-shorted line writes nothing)", () => {
    const p = plan([
      order([
        line({ is_shorted: true, quantity_fulfilled: 0 }),
        line({ is_shorted: true, quantity_fulfilled: null, size_label: "B" }),
        line({ quantity_requested: -1, size_label: "C" }),
      ]),
    ]);
    expect(p.rowsToInsert).toEqual([]);
    expect(reasons(p)).toEqual(["zero_quantity", "zero_quantity", "zero_quantity"]);
    // The order still had resolved lines, so its delivery row is planned
    // (matches the pre-refactor behaviour: an empty delivery, never a missing one).
    expect(p.deliveriesToCreate).toHaveLength(1);
  });
});

describe("planDeliveryRows — unit", () => {
  it("lowercases the line unit, falls back to the item's first unit, then 'ea'", () => {
    const p = plan([
      order([
        line({ unit_type: "LG" }),
        line({ unit_type: null, item: { ...basil, id: "item-2", unit_type: "gb,lbs" } }),
        line({ unit_type: "  ", item: { ...basil, id: "item-3", unit_type: null } }),
      ]),
    ]);
    expect(p.rowsToInsert.map((r) => r.unit)).toEqual(["lg", "gb", "ea"]);
  });

  it("skips units outside the known list", () => {
    const p = plan([order([line({ unit_type: "crate" })])]);
    expect(p.rowsToInsert).toEqual([]);
    expect(reasons(p)).toEqual(["invalid_unit"]);
  });

  it("skips lines whose catalog item is missing", () => {
    const p = plan([order([line({ item: null })])]);
    expect(reasons(p)).toEqual(["no_item"]);
  });
});

describe("planDeliveryRows — price precedence", () => {
  it("prefers the price frozen on the order line", () => {
    const p = plan([order([line({ unit_price_at_order: "9.5", size_label: "Palm" })])]);
    expect(p.rowsToInsert[0].unit_price).toBe(9.5);
  });

  it("falls back size → unit → default → 0, via resolveOrderUnitPrice", () => {
    const p = plan([
      order([
        line({ size_label: "Palm" }), // size override
        line({ size_label: "Other" }), // unit override
        line({ unit_type: "sm", size_label: "Other2", item: { ...basil, unit_prices: {} } }), // default
        line({ unit_type: "ea", item: { ...basil, id: "item-free", unit_prices: null, default_price: null } }), // 0
      ]),
    ]);
    expect(p.rowsToInsert.map((r) => r.unit_price)).toEqual([1, 12, 5, 0]);
    // Same answers the order-submit flow would freeze.
    expect(resolveOrderUnitPrice({ unitPrices: basil.unit_prices, defaultPrice: 5, sizePrices: basil.size_prices }, "lg", "Palm")).toBe(1);
    expect(resolveOrderUnitPrice({ unitPrices: basil.unit_prices, defaultPrice: 5, sizePrices: basil.size_prices }, "lg", "Other")).toBe(12);
  });

  it("treats a numeric-string default_price as a number", () => {
    const p = plan([order([line({ unit_type: "ea", item: { ...basil, unit_prices: {}, default_price: "4.25" } })])]);
    expect(p.rowsToInsert[0].unit_price).toBe(4.25);
  });

  it('resolves "LG" and "lg" to the same unit price (unit is normalized before the catalog lookup)', () => {
    const upper = plan([order([line({ unit_type: "LG" })])]);
    const lower = plan([order([line({ unit_type: "lg" })])]);
    expect(upper.rowsToInsert[0].unit_price).toBe(12);
    expect(upper.rowsToInsert[0]).toEqual({ ...lower.rowsToInsert[0] });
    // resolveOrderUnitPrice itself does NOT normalize — which is why the planner must.
    expect(resolveOrderUnitPrice({ unitPrices: basil.unit_prices, defaultPrice: 5 }, "LG")).toBe(5);
    expect(resolveOrderUnitPrice({ unitPrices: basil.unit_prices, defaultPrice: 5 }, "lg")).toBe(12);
  });
});

describe("planDeliveryRows — dedupe against existing rows", () => {
  const del = { id: "del-1", restaurant_id: PRESS, status: "logged" };

  it("never rewrites a (delivery, item, unit, size) row already in the DB", () => {
    const p = plan(
      [order([line({ size_label: "Palm" }), line({ size_label: "Dime" })])],
      [del],
      [{ delivery_id: "del-1", item_id: basil.id, unit: "LG", size_label: "palm " }], // case/space-insensitive
    );
    expect(p.rowsToInsert.map((r) => r.size_label)).toEqual(["Dime"]);
    expect(reasons(p)).toEqual(["already_in_db"]);
  });

  it("a legacy size-less row suppresses every sized line of that item+unit, not size-less ones", () => {
    const p = plan(
      [
        order([
          line({ size_label: "Palm" }),
          line({ size_label: "Dime" }),
          line({ size_label: null }), // exact-key dedupe → already_in_db
          line({ unit_type: "sm", size_label: "Palm" }), // different unit → unaffected
        ]),
      ],
      [del],
      [{ delivery_id: "del-1", item_id: basil.id, unit: "lg", size_label: null }],
    );
    expect(p.rowsToInsert.map((r) => `${r.unit}|${r.size_label}`)).toEqual(["sm|Palm"]);
    expect(reasons(p)).toEqual(["legacy_sizeless_row", "legacy_sizeless_row", "already_in_db"]);
  });

  it("skips every line of a finalized delivery", () => {
    const p = plan([order([line(), line({ size_label: "Palm" })])], [{ ...del, status: "finalized" }]);
    expect(p.rowsToInsert).toEqual([]);
    expect(reasons(p)).toEqual(["finalized_delivery", "finalized_delivery"]);
  });

  it("existing rows on a different delivery don't affect this one", () => {
    const p = plan(
      [order([line()])],
      [del],
      [{ delivery_id: "del-other", item_id: basil.id, unit: "lg", size_label: null }],
    );
    expect(p.rowsToInsert).toHaveLength(1);
  });
});

describe("planDeliveryRows — intra-batch merge", () => {
  it("merges same-key lines when the price matches (two varieties → one row)", () => {
    const p = plan([order([line({ quantity_requested: 2 }), line({ quantity_requested: 3 })])]);
    expect(p.rowsToInsert).toHaveLength(1);
    expect(p.rowsToInsert[0].quantity).toBe(5);
    expect(reasons(p)).toEqual(["merged"]);
  });

  it("merges across orders on the same restaurant (Events: several orders per date)", () => {
    const p = plan([
      order([line({ quantity_requested: 1 })], { restaurant_id: EVENTS }),
      order([line({ quantity_requested: 4 })], { restaurant_id: EVENTS }),
    ]);
    expect(p.rowsToInsert).toHaveLength(1);
    expect(p.rowsToInsert[0].quantity).toBe(5);
  });

  it("does NOT merge across restaurants", () => {
    const p = plan([order([line()]), order([line()], { restaurant_id: EVENTS })]);
    expect(p.rowsToInsert).toHaveLength(2);
  });

  it("first wins when the price differs", () => {
    const p = plan([order([line({ unit_price_at_order: 10, quantity_requested: 2 }), line({ unit_price_at_order: 11, quantity_requested: 3 })])]);
    expect(p.rowsToInsert).toHaveLength(1);
    expect(p.rowsToInsert[0]).toMatchObject({ quantity: 2, unit_price: 10 });
    expect(reasons(p)).toEqual(["price_mismatch_first_wins"]);
  });
});

describe("summarizeSkips", () => {
  it("is silent for ordinary dedupe and loud for data-shape problems", () => {
    expect(summarizeSkips([{ orderId: "o", orderItemId: "a", reason: "already_in_db" }])).toBeUndefined();
    expect(summarizeSkips([{ orderId: "o", orderItemId: "a", reason: "merged" }])).toBeUndefined();
    const msg = summarizeSkips([
      { orderId: "o", orderItemId: "a", reason: "invalid_unit" },
      { orderId: "o", orderItemId: "b", reason: "invalid_unit" },
      { orderId: "o", orderItemId: "c", reason: "legacy_sizeless_row" },
    ]);
    expect(msg).toContain("2 unrecognized unit");
    expect(msg).toContain("1 already covered by an older size-less delivery row");
  });
});

/**
 * Minimal chainable stub for the wrapper: every query resolves to the
 * canned `{data, error}` for its table + op, in call order.
 */
function fakeAdmin(script: Record<string, Array<{ data?: unknown; error?: unknown }>>) {
  const calls: Array<{ table: string; op: string; payload?: unknown }> = [];
  const next = (key: string) => script[key]?.shift() ?? { data: [], error: null };
  const from = (table: string) => {
    let op = "select";
    let payload: unknown;
    const chain: any = {
      select: (..._a: unknown[]) => chain,
      eq: () => chain,
      in: () => chain,
      insert: (p: unknown) => {
        op = "insert";
        payload = p;
        return chain;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        calls.push({ table, op, payload });
        return Promise.resolve(next(`${table}:${op}`)).then(resolve, reject);
      },
    };
    return chain;
  };
  return { admin: { from }, calls };
}

describe("materializeDeliveryItems (wrapper)", () => {
  const orders = [order([line({ quantity_requested: 2 })])];

  it("creates the delivery, fills its id into the rows, and reports the count", async () => {
    const { admin, calls } = fakeAdmin({
      "orders:select": [{ data: orders }],
      "deliveries:select": [{ data: [] }],
      "deliveries:insert": [{ data: [{ id: "del-new", restaurant_id: PRESS, status: "logged" }] }],
      "delivery_items:insert": [{ error: null }],
    });
    const res = await materializeDeliveryItems(admin, DATE);
    expect(res).toEqual({ created: 1, failed: false, warning: undefined });
    const itemInsert = calls.find((c) => c.table === "delivery_items" && c.op === "insert");
    expect(itemInsert?.payload).toEqual([
      { delivery_id: "del-new", item_id: basil.id, quantity: 2, unit: "lg", size_label: null, unit_price: 12 },
    ]);
  });

  it("reports a failed delivery_items insert instead of swallowing it", async () => {
    const { admin } = fakeAdmin({
      "orders:select": [{ data: orders }],
      "deliveries:select": [{ data: [{ id: "del-1", restaurant_id: PRESS, status: "logged" }] }],
      "delivery_items:select": [{ data: [] }],
      "delivery_items:insert": [{ error: { message: "check constraint violated" } }],
    });
    const res = await materializeDeliveryItems(admin, DATE);
    expect(res.failed).toBe(true);
    expect(res.created).toBe(0);
    expect(res.error).toContain("delivery_items insert");
  });

  it("reports a failed read too (no silent zero)", async () => {
    const { admin } = fakeAdmin({ "orders:select": [{ data: null, error: { message: "boom" } }] });
    const res = await materializeDeliveryItems(admin, DATE);
    expect(res).toMatchObject({ failed: true, created: 0 });
  });

  it("is a clean no-op when there are no orders", async () => {
    const { admin } = fakeAdmin({ "orders:select": [{ data: [] }] });
    expect(await materializeDeliveryItems(admin, DATE)).toEqual({ created: 0, failed: false });
  });
});
