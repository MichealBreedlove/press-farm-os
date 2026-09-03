import { describe, it, expect } from "vitest";
import { fetchAvailabilityWithRollover, materializeRollover, remapInheritedRows } from "@/lib/availability";
import { makeSupabaseMock } from "../helpers/supabase-mock";

/**
 * Regression suite for the 2026-06-10 ordering incident:
 *  - Press's 06-11 list was published with EVERY item unavailable.
 *  - The chef order page hid the unavailable rows, saw "no rows", and rolled
 *    over to 06-08's list — whose availability IDs then failed submit
 *    validation against 06-11.
 *  - materializeRollover could only insert the two rolled-over items that
 *    were ARCHIVED (the rest collided with the unavailable rows), after
 *    which the date looked "published" but the form rendered nothing.
 */

const PRESS = "press-id";

function availRow(over: Record<string, any>) {
  return {
    id: over.id ?? crypto.randomUUID(),
    item_id: over.item_id ?? crypto.randomUUID(),
    restaurant_id: PRESS,
    delivery_date: "2026-06-08",
    status: "available",
    limited_qty: null,
    cycle_notes: null,
    available_sizes: null,
    available_colors: null,
    available_varieties: null,
    available_units: null,
    item: { is_archived: false },
    ...over,
  };
}

describe("fetchAvailabilityWithRollover", () => {
  it("returns direct rows without rollover when the date has visible rows", async () => {
    const supabase = makeSupabaseMock({
      availability_items: [
        availRow({ delivery_date: "2026-06-11", status: "available" }),
        availRow({ delivery_date: "2026-06-08", status: "available" }),
      ],
    });
    const { data, isInherited, sourceDate } = await fetchAvailabilityWithRollover(supabase, {
      deliveryDate: "2026-06-11",
      restaurantId: PRESS,
      hideUnavailable: true,
    });
    expect(isInherited).toBe(false);
    expect(sourceDate).toBe("2026-06-11");
    expect(data).toHaveLength(1);
  });

  it("does NOT roll over when the date is published but everything is unavailable", async () => {
    const supabase = makeSupabaseMock({
      availability_items: [
        availRow({ delivery_date: "2026-06-11", status: "unavailable" }),
        availRow({ delivery_date: "2026-06-11", status: "unavailable" }),
        // Prior date has a real list — must NOT be resurrected.
        availRow({ delivery_date: "2026-06-08", status: "available" }),
      ],
    });
    const { data, isInherited } = await fetchAvailabilityWithRollover(supabase, {
      deliveryDate: "2026-06-11",
      restaurantId: PRESS,
      hideUnavailable: true,
    });
    expect(isInherited).toBe(false);
    expect(data).toHaveLength(0);
  });

  it("rolls over from the most recent prior date when the date has no rows at all", async () => {
    const supabase = makeSupabaseMock({
      availability_items: [
        availRow({ delivery_date: "2026-06-06", status: "available" }),
        availRow({ delivery_date: "2026-06-08", status: "available" }),
        availRow({ delivery_date: "2026-06-08", status: "limited" }),
        availRow({ delivery_date: "2026-06-08", status: "unavailable" }),
      ],
    });
    const { data, isInherited, sourceDate } = await fetchAvailabilityWithRollover(supabase, {
      deliveryDate: "2026-06-11",
      restaurantId: PRESS,
      hideUnavailable: true,
    });
    expect(isInherited).toBe(true);
    expect(sourceDate).toBe("2026-06-08");
    // unavailable filtered, remaining rows remapped to the requested date
    expect(data).toHaveLength(2);
    expect(data.every((r: any) => r.delivery_date === "2026-06-11")).toBe(true);
  });

  it("excludes archived items from rolled-over rows", async () => {
    const supabase = makeSupabaseMock({
      availability_items: [
        availRow({ delivery_date: "2026-06-08", status: "available" }),
        availRow({ delivery_date: "2026-06-08", status: "available", item: { is_archived: true } }),
      ],
    });
    const { data, isInherited } = await fetchAvailabilityWithRollover(supabase, {
      deliveryDate: "2026-06-11",
      restaurantId: PRESS,
      hideUnavailable: true,
    });
    expect(isInherited).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].item.is_archived).toBe(false);
  });

  it("scopes rollover to the requested restaurant", async () => {
    const supabase = makeSupabaseMock({
      availability_items: [
        availRow({ delivery_date: "2026-06-09", restaurant_id: "other-id", status: "available" }),
        availRow({ delivery_date: "2026-06-08", status: "available" }),
      ],
    });
    const { sourceDate, data } = await fetchAvailabilityWithRollover(supabase, {
      deliveryDate: "2026-06-11",
      restaurantId: PRESS,
      hideUnavailable: true,
    });
    expect(sourceDate).toBe("2026-06-08");
    expect(data.every((r: any) => r.restaurant_id === PRESS)).toBe(true);
  });
});

describe("materializeRollover", () => {
  it("creates rows for the target date from rolled-over source rows", async () => {
    const supabase = makeSupabaseMock({ availability_items: [] });
    const source = [
      availRow({ item_id: "item-1", status: "available", available_varieties: "Genovese,Thai" }),
      availRow({ item_id: "item-2", status: "limited", limited_qty: 5 }),
    ];
    await materializeRollover(supabase, source, "2026-06-11");
    const rows = supabase._data.availability_items;
    expect(rows).toHaveLength(2);
    expect(rows.every((r: any) => r.delivery_date === "2026-06-11")).toBe(true);
    expect(rows.find((r: any) => r.item_id === "item-2")?.limited_qty).toBe(5);
    // Per-cycle variety override rides the rollover forward like sizes/colors.
    expect(rows.find((r: any) => r.item_id === "item-1")?.available_varieties).toBe("Genovese,Thai");
  });

  it("never materializes archived items", async () => {
    const supabase = makeSupabaseMock({ availability_items: [] });
    const source = [
      availRow({ item_id: "live-item" }),
      availRow({ item_id: "archived-item", item: { is_archived: true } }),
    ];
    await materializeRollover(supabase, source, "2026-06-11");
    const rows = supabase._data.availability_items;
    expect(rows).toHaveLength(1);
    expect(rows[0].item_id).toBe("live-item");
  });

  it("ignores duplicates instead of overwriting existing rows", async () => {
    const supabase = makeSupabaseMock({
      availability_items: [
        availRow({
          item_id: "item-1",
          delivery_date: "2026-06-11",
          status: "unavailable",
        }),
      ],
    });
    await materializeRollover(supabase, [availRow({ item_id: "item-1", status: "available" })], "2026-06-11");
    const rows = supabase._data.availability_items;
    expect(rows).toHaveLength(1);
    // Existing row untouched — ignoreDuplicates, not last-write-wins.
    expect(rows[0].status).toBe("unavailable");
  });
});

/**
 * Regression suite for the 2026-09-03 first-load failure: the order page
 * materialized the rolled-over rows, then "refetched" — but React memoizes
 * identical GETs within a server render, so the refetch replayed the
 * pre-insert result and the form shipped the PRIOR date's ids. Submit then
 * rejected every line ("the availability list changed"). The fix: the
 * materializer hands back rows already carrying the target date's ids.
 */
describe("materializeRollover return value", () => {
  it("returns the source rows rewritten with the target date's real ids", async () => {
    const supabase = makeSupabaseMock({ availability_items: [] });
    const source = [
      availRow({ id: "old-1", item_id: "item-1", _inheritedFrom: "2026-06-08" }),
      availRow({ id: "old-2", item_id: "item-2", _inheritedFrom: "2026-06-08" }),
    ];
    const out = await materializeRollover(supabase, source, "2026-06-11");
    const written = supabase._data.availability_items;
    expect(out).toHaveLength(2);
    for (const row of out) {
      const real = written.find((w: any) => w.item_id === row.item_id);
      expect(real).toBeDefined();
      expect(row.id).toBe(real!.id);
      expect(row.id).not.toMatch(/^old-/);
      expect(row.delivery_date).toBe("2026-06-11");
      expect((row as any)._inheritedFrom).toBeUndefined();
      // Everything else (joined item, per-cycle overrides) survives.
      expect(row.item).toEqual({ is_archived: false });
    }
  });

  it("maps onto rows another request already created (concurrent first loads)", async () => {
    const supabase = makeSupabaseMock({
      availability_items: [
        availRow({ id: "already-there", item_id: "item-1", delivery_date: "2026-06-11", status: "limited" }),
      ],
    });
    const out = await materializeRollover(
      supabase,
      [availRow({ id: "old-1", item_id: "item-1", status: "available" })],
      "2026-06-11",
    );
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("already-there");
  });

  it("returns nothing for archived-only input", async () => {
    const supabase = makeSupabaseMock({ availability_items: [] });
    const out = await materializeRollover(
      supabase,
      [availRow({ item_id: "gone", item: { is_archived: true } })],
      "2026-06-11",
    );
    expect(out).toEqual([]);
  });
});

describe("remapInheritedRows", () => {
  it("swaps ids by item_id and drops rows with no target counterpart", () => {
    const out = remapInheritedRows(
      [
        { id: "old-a", item_id: "a", delivery_date: "2026-06-08", _inheritedFrom: "2026-06-08" } as any,
        { id: "old-b", item_id: "b", delivery_date: "2026-06-08" } as any,
      ],
      [{ id: "new-a", item_id: "a" }],
      "2026-06-11",
    );
    expect(out).toEqual([{ id: "new-a", item_id: "a", delivery_date: "2026-06-11" }]);
  });
});
