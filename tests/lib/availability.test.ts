import { describe, it, expect } from "vitest";
import { fetchAvailabilityWithRollover, materializeRollover } from "@/lib/availability";
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
