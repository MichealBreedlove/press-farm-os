import { describe, it, expect } from "vitest";
import { collectOrderedLines, countOrderedLines, groupByCategory } from "@/lib/order/lines";
import { EVENT_MENU_KEY_PREFIX } from "@/lib/constants";

const ai = (id: string, over: Record<string, any> = {}, item: Record<string, any> = {}) =>
  ({
    id,
    status: "available",
    available_units: null,
    available_sizes: null,
    available_colors: null,
    available_varieties: null,
    ...over,
    item: { id: `item-${id}`, name: id, category: "flowers", unit_type: "ea", size: null, color: null, variety: null, ...item },
  }) as any;

describe("collectOrderedLines", () => {
  it("emits one line per ordered cell and skips zero quantities", () => {
    const peas = ai("peas");
    const nast = ai("nast", {}, { unit_type: "sm,lg", size: "Quarter,Palm" });
    const lines = collectOrderedLines(
      [
        { ai: peas, section: "regular" },
        { ai: nast, section: "regular" },
      ],
      {
        quantities: { peas: 2, "nast__unit:lg__Palm": 1, "nast__unit:sm__Quarter": 0 },
        itemNotes: { nast: "gentle" },
        itemColors: { "nast__unit:lg__Palm": ["red"] },
        itemVarieties: {},
      },
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ availabilityItemId: "peas", unit: "ea", unitExplicit: false, size: null, quantity: 2 });
    expect(lines[1]).toMatchObject({
      availabilityItemId: "nast",
      unit: "lg",
      unitExplicit: true,
      size: "Palm",
      colors: ["red"],
      quantity: 1,
      itemNote: "gentle",
    });
  });

  it("maps a split item's event portion back to the real availability id", () => {
    const base = ai("sq");
    const clone = { ...base, id: `${EVENT_MENU_KEY_PREFIX}sq` };
    const realId = (id: string) => (id.startsWith(EVENT_MENU_KEY_PREFIX) ? id.slice(EVENT_MENU_KEY_PREFIX.length) : id);
    const lines = collectOrderedLines(
      [
        { ai: base, section: "regular" },
        { ai: clone, section: "events" },
      ],
      { quantities: { sq: 3, [`${EVENT_MENU_KEY_PREFIX}sq`]: 5 }, itemNotes: {}, itemColors: {}, itemVarieties: {} },
      realId,
    );
    expect(lines.map((l) => [l.availabilityItemId, l.section, l.quantity])).toEqual([
      ["sq", "regular", 3],
      ["sq", "events", 5],
    ]);
  });

  it("countOrderedLines matches the number of lines collected", () => {
    const src = [{ ai: ai("a", {}, { unit_type: "sm,lg" }), section: "regular" as const }];
    const q = { "a__unit:sm": 1, "a__unit:lg": 4 };
    expect(countOrderedLines(src, q)).toBe(2);
    expect(collectOrderedLines(src, { quantities: q, itemNotes: {}, itemColors: {}, itemVarieties: {} })).toHaveLength(2);
  });
});

describe("groupByCategory", () => {
  it("buckets by category and sorts names case-insensitively", () => {
    const g = groupByCategory([
      ai("b", {}, { name: "basil", category: "herbs_leaves" }),
      ai("a", {}, { name: "Anise", category: "herbs_leaves" }),
      ai("f", {}, { name: "Fennel pollen", category: "flowers" }),
    ]);
    expect(g.herbs_leaves.map((x) => x.item.name)).toEqual(["Anise", "basil"]);
    expect(g.flowers.map((x) => x.item.name)).toEqual(["Fennel pollen"]);
  });
});
