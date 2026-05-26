# Chef Forecast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/order/forecast` — a chef-facing read-only page that shows what was, is, and will be available from Press Farm across a full year (past delivery actuals + current concrete plantings + seasonal hints for further months).

**Architecture:** Server component fetches three data zones (past `delivery_items`, current `src/lib/forecasting/` output, future `items.seasonal_months` hints). Client component holds selected-year/month/week state. Three sibling drawer components render zone-specific content. Pure compute helpers in `src/lib/forecasting/yearView.ts` are unit-tested with Vitest; page gets a thin smoke test.

**Tech Stack:** Next.js 14 App Router (server + client components), TypeScript strict, Supabase (PostgreSQL 15), Tailwind with `farm-*` and `pf-master-*` tokens, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-05-26-chef-forecast-design.md` (commit `1756a5b`)

**Branch:** work directly on `main`. Push triggers Vercel deploy. **Do not push tasks 2–9 until task 1's migration is confirmed running in Supabase prod** — schema-dependent SELECTs will 500 the page.

---

## File map

**New:**

- `supabase/migrations/059_items_seasonal_months.sql`
- `src/lib/forecasting/yearView.ts` — pure compute (`historicalWeeks`, `monthDensity`, `monthSeasonalItems`)
- `src/app/order/forecast/page.tsx` — server component (auth + data fetch)
- `src/app/order/forecast/ForecastClient.tsx` — client component (selected state)
- `src/components/order/forecast/YearMonthTabs.tsx`
- `src/components/order/forecast/WeekStrip.tsx`
- `src/components/order/forecast/DetailDrawer.tsx` — zone-aware switcher
- `src/components/order/forecast/PastWeekDetail.tsx`
- `src/components/order/forecast/ConcreteWeekDetail.tsx`
- `src/components/order/forecast/SeasonalMonthDetail.tsx`
- `tests/lib/forecasting/yearView.test.ts`
- `tests/app/order/forecast/page.test.tsx`

**Modified:**

- `src/lib/forecasting/types.ts` — add `HistoricalDeliveryRow`, `SeasonalItemRow`, `WeekBucket`, `MonthDensity`
- `src/lib/forecasting/fetch.ts` — add `fetchHistoricalDeliveries`, `fetchSeasonalItems`
- `src/lib/forecasting/index.ts` — export new lib surface
- `src/types/database.ts` — extend `items` type with `seasonal_months`
- `src/app/admin/items/[itemId]/ItemForm.tsx` — add 12-chip month selector
- `src/app/api/items/[itemId]/route.ts` (or wherever the PATCH handler is) — persist `seasonal_months`

**Spec correction:** the spec said the chef forecast page uses `EditorialHero`. It does **not** — that component is for admin landing pages. The chef forecast page uses the chef-portal `<header class="page-header"><h1 class="page-title">` pattern from `src/app/order/page.tsx`.

---

### Task 1: Migration 059 — `items.seasonal_months` schema + seed

**Files:**
- Create: `supabase/migrations/059_items_seasonal_months.sql`

**Context:** The user does NOT have the Supabase CLI linked. After writing the file, present the SQL to the user; they paste it into the web SQL editor at `https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new`. Do not push any code that references `seasonal_months` until the user confirms the migration ran.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/059_items_seasonal_months.sql
-- Add seasonal_months int[] column to items + seed from past 12 months of deliveries.

ALTER TABLE items
  ADD COLUMN seasonal_months int[] NOT NULL DEFAULT '{}'::int[];

ALTER TABLE items
  ADD CONSTRAINT items_seasonal_months_valid
  CHECK (seasonal_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]);

COMMENT ON COLUMN items.seasonal_months IS
  'Months (1=Jan..12=Dec) when this item is typically available. Used by /order/forecast to fill out the far-future zone where there is no concrete planting data yet.';

-- One-time seed: for each item, the months where it was delivered ≥2 times
-- in the past 12 months become its default seasonal_months.
WITH item_months AS (
  SELECT
    di.item_id,
    EXTRACT(MONTH FROM d.delivery_date)::int AS month,
    COUNT(*) AS deliveries_in_month
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.delivery_date >= NOW() - INTERVAL '12 months'
    AND d.delivery_date < NOW()
  GROUP BY di.item_id, EXTRACT(MONTH FROM d.delivery_date)::int
  HAVING COUNT(*) >= 2
),
item_arrays AS (
  SELECT
    item_id,
    ARRAY_AGG(DISTINCT month ORDER BY month) AS months
  FROM item_months
  GROUP BY item_id
)
UPDATE items i
SET seasonal_months = ia.months
FROM item_arrays ia
WHERE i.id = ia.item_id;
```

- [ ] **Step 2: Present the migration to the user**

Output the SQL block above to the conversation with this preface:

> Migration 059 is ready. Open the Supabase SQL editor at
> https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new
> paste the SQL below, run it, and tell me when it's done. After that I'll
> ship the code that uses the new column. The seed at the bottom is safe to
> re-run (idempotent on the column add fails, the UPDATE just rewrites).

**Wait for user confirmation before proceeding to Task 2.**

- [ ] **Step 3: Commit the migration file (without pushing)**

```bash
cd /c/Users/mikej/Lab/press-farm-os
git add supabase/migrations/059_items_seasonal_months.sql
git commit -m "$(cat <<'EOF'
feat(items): migration 059 — seasonal_months column for chef forecast

Adds items.seasonal_months int[] with month-number CHECK constraint.
Seeds from past 12 months of delivery_items (items delivered ≥2 times
in a given month get that month included).

Powers the far-future zone of /order/forecast where there is no
concrete planting data yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Do not `git push` yet. Push at the end of Task 9 along with all the code.

---

### Task 2: Extend types

**Files:**
- Modify: `src/types/database.ts` (extend the `items` row type)
- Modify: `src/lib/forecasting/types.ts` (add four new types)

- [ ] **Step 1: Locate the items row type in `src/types/database.ts`**

Grep for `items:` or `interface Item` to find the existing type. Add `seasonal_months: number[]` to the row shape (matching the actual column type).

- [ ] **Step 2: Add new types to `src/lib/forecasting/types.ts`**

Append to the end of the existing file:

```typescript
// ─── Year-view types (for /order/forecast) ───────────────────────────────────

/**
 * Past delivery actuals row — what was actually shipped to a restaurant in
 * a given week. Sourced from delivery_items JOIN deliveries.
 */
export interface HistoricalDeliveryRow {
  delivery_date: string;
  item_id: string;
  item_name: string;
  category: string | null;
  unit_type: string | null;
  quantity: number;
  unit: string;
}

/**
 * Item with seasonal_months populated — used by the far-future "seasonal" zone.
 */
export interface SeasonalItemRow {
  id: string;
  name: string;
  category: string | null;
  seasonal_months: number[];
}

/**
 * A bucket of historical deliveries grouped by ISO week.
 */
export interface WeekBucket {
  /** ISO week-start date (Monday), YYYY-MM-DD. */
  weekStart: string;
  /** Distinct items delivered that week, sorted by name. */
  items: Array<{
    id: string;
    name: string;
    category: string | null;
    unit_type: string | null;
    /** Sum across all delivery_items rows for that item in that week. */
    quantity: number;
    /** Most-common unit for that item-week (e.g. "lb" or "lg"). */
    unit: string;
  }>;
}

/**
 * Density bucket for a single month in the year strip.
 */
export interface MonthDensity {
  /** 1=Jan..12=Dec */
  month: number;
  /** Distinct-item count, deduplicated across all three zones. */
  count: number;
  /** Highest-priority zone touching this month, used to pick tab styling. */
  zone: "past" | "concrete" | "seasonal" | "empty";
}
```

- [ ] **Step 3: Re-export from `src/lib/forecasting/index.ts`**

Add to the existing `export type { ... }` block at the bottom:

```typescript
  HistoricalDeliveryRow,
  SeasonalItemRow,
  WeekBucket,
  MonthDensity,
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run build 2>&1 | tail -10`
Expected: build passes (no new code uses the types yet, so this confirms the types themselves are well-formed).

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/lib/forecasting/types.ts src/lib/forecasting/index.ts
git commit -m "$(cat <<'EOF'
feat(forecasting): add year-view types for chef forecast page

HistoricalDeliveryRow, SeasonalItemRow, WeekBucket, MonthDensity —
public types for the new /order/forecast page's three data zones.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Pure compute — `historicalWeeks`

**Files:**
- Create: `src/lib/forecasting/yearView.ts`
- Create: `tests/lib/forecasting/yearView.test.ts`

ISO week math: use UTC ISO-8601 weeks (Monday-start). Reuse `addDays`, `toIso`, `daysBetween` from `src/lib/forecasting/dates.ts`. Add one local helper `isoWeekStart(iso)` that returns the Monday of that week.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/forecasting/yearView.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { historicalWeeks } from "@/lib/forecasting/yearView";
import type { HistoricalDeliveryRow } from "@/lib/forecasting/types";

function row(overrides: Partial<HistoricalDeliveryRow> = {}): HistoricalDeliveryRow {
  return {
    delivery_date: "2026-05-21",
    item_id: "item-1",
    item_name: "Mustard Flowers",
    category: "flowers",
    unit_type: "ea",
    quantity: 5,
    unit: "ea",
    ...overrides,
  };
}

describe("historicalWeeks", () => {
  it("returns empty array for empty input", () => {
    expect(historicalWeeks("2026-01-01", "2026-12-31", [])).toEqual([]);
  });

  it("buckets deliveries by ISO week-start (Monday)", () => {
    // 2026-05-21 is a Thursday → week-start Mon 2026-05-18
    // 2026-05-22 is a Friday   → same week
    // 2026-05-26 is a Tuesday  → week-start Mon 2026-05-25
    const result = historicalWeeks("2026-05-01", "2026-05-31", [
      row({ delivery_date: "2026-05-21", item_id: "a", item_name: "A" }),
      row({ delivery_date: "2026-05-22", item_id: "b", item_name: "B" }),
      row({ delivery_date: "2026-05-26", item_id: "c", item_name: "C" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ weekStart: "2026-05-18" });
    expect(result[0]?.items.map((i) => i.id).sort()).toEqual(["a", "b"]);
    expect(result[1]).toMatchObject({ weekStart: "2026-05-25" });
    expect(result[1]?.items.map((i) => i.id)).toEqual(["c"]);
  });

  it("sums quantity for the same item delivered twice in one week", () => {
    const result = historicalWeeks("2026-05-01", "2026-05-31", [
      row({ delivery_date: "2026-05-21", item_id: "a", item_name: "A", quantity: 3 }),
      row({ delivery_date: "2026-05-23", item_id: "a", item_name: "A", quantity: 4 }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.items[0]?.quantity).toBe(7);
  });

  it("ignores deliveries outside the requested window", () => {
    const result = historicalWeeks("2026-05-01", "2026-05-31", [
      row({ delivery_date: "2026-04-30", item_id: "before" }),
      row({ delivery_date: "2026-06-01", item_id: "after" }),
      row({ delivery_date: "2026-05-15", item_id: "in" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.items.map((i) => i.id)).toEqual(["in"]);
  });

  it("sorts items within a week alphabetically by name", () => {
    const result = historicalWeeks("2026-05-01", "2026-05-31", [
      row({ delivery_date: "2026-05-21", item_id: "z", item_name: "Zinnias" }),
      row({ delivery_date: "2026-05-21", item_id: "a", item_name: "Amaranth" }),
      row({ delivery_date: "2026-05-21", item_id: "m", item_name: "Marigold" }),
    ]);
    expect(result[0]?.items.map((i) => i.name)).toEqual([
      "Amaranth", "Marigold", "Zinnias",
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/forecasting/yearView.test.ts`
Expected: FAIL with `Cannot find module '@/lib/forecasting/yearView'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/forecasting/yearView.ts`:

```typescript
/**
 * Year-view compute for the chef forecast page (/order/forecast).
 *
 * Three pure functions, each owning one data zone:
 *   - historicalWeeks  → past delivery actuals → weekly buckets
 *   - monthDensity     → distinct-item count per month across all zones
 *   - monthSeasonalItems → seasonal hints for a single month
 *
 * No I/O. All Supabase access lives in fetch.ts.
 */

import { addDays, isWithin, toIso } from "./dates";
import type {
  HistoricalDeliveryRow,
  SeasonalItemRow,
  WeekBucket,
  MonthDensity,
  ForecastCalendarEvent,
} from "./types";

/** Monday of the ISO week containing the given ISO date (UTC). */
function isoWeekStart(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  // getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat. Shift so Monday=0.
  const offset = (d.getUTCDay() + 6) % 7;
  return toIso(addDays(iso, -offset));
}

/**
 * Bucket delivery_items by ISO week (Monday-start).
 *
 * Rows outside [from, to] are dropped. Within a week, the same item appearing
 * in multiple rows is summed. Items within a week are sorted by name.
 */
export function historicalWeeks(
  from: string,
  to: string,
  rows: HistoricalDeliveryRow[],
): WeekBucket[] {
  const buckets = new Map<string, Map<string, WeekBucket["items"][number]>>();

  for (const r of rows) {
    if (!isWithin(r.delivery_date, from, to)) continue;
    const weekStart = isoWeekStart(r.delivery_date);
    let week = buckets.get(weekStart);
    if (!week) {
      week = new Map();
      buckets.set(weekStart, week);
    }
    const existing = week.get(r.item_id);
    if (existing) {
      existing.quantity += r.quantity;
    } else {
      week.set(r.item_id, {
        id: r.item_id,
        name: r.item_name,
        category: r.category,
        unit_type: r.unit_type,
        quantity: r.quantity,
        unit: r.unit,
      });
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, items]) => ({
      weekStart,
      items: Array.from(items.values()).sort((a, b) => a.name.localeCompare(b.name)),
    }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/lib/forecasting/yearView.test.ts`
Expected: PASS, 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forecasting/yearView.ts tests/lib/forecasting/yearView.test.ts
git commit -m "$(cat <<'EOF'
feat(forecasting): historicalWeeks pure compute

Buckets delivery_items by ISO Monday-start weeks. Sums same-item rows
within a week. Sorts items by name. Drops rows outside the window.

Five Vitest specs, all green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Pure compute — `monthDensity` and `monthSeasonalItems`

**Files:**
- Modify: `src/lib/forecasting/yearView.ts`
- Modify: `tests/lib/forecasting/yearView.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/lib/forecasting/yearView.test.ts`:

```typescript
import { monthDensity, monthSeasonalItems } from "@/lib/forecasting/yearView";
import type { SeasonalItemRow, MonthDensity } from "@/lib/forecasting/types";

describe("monthDensity", () => {
  it("returns 12-element array for any year", () => {
    const result = monthDensity(2026, {
      past: [],
      concrete: [],
      seasonal: [],
    });
    expect(result).toHaveLength(12);
    expect(result.map((m) => m.month)).toEqual([1,2,3,4,5,6,7,8,9,10,11,12]);
  });

  it("marks empty months as zone=empty count=0", () => {
    const result = monthDensity(2026, { past: [], concrete: [], seasonal: [] });
    expect(result.every((m) => m.zone === "empty" && m.count === 0)).toBe(true);
  });

  it("counts seasonal items per their seasonal_months", () => {
    const seasonal: SeasonalItemRow[] = [
      { id: "tom", name: "Tomato",   category: "fruit_veg", seasonal_months: [7, 8, 9] },
      { id: "bsl", name: "Basil",    category: "herbs_leaves", seasonal_months: [6, 7, 8] },
      { id: "kal", name: "Kale",     category: "herbs_leaves", seasonal_months: [10, 11] },
    ];
    const result = monthDensity(2026, { past: [], concrete: [], seasonal });
    expect(result[6]).toMatchObject({ month: 7, count: 2, zone: "seasonal" }); // Jul: tom, bsl
    expect(result[7]).toMatchObject({ month: 8, count: 2, zone: "seasonal" }); // Aug: tom, bsl
    expect(result[9]).toMatchObject({ month: 10, count: 1, zone: "seasonal" }); // Oct: kal
  });

  it("does not double-count items by name across concrete and seasonal", () => {
    // Items are deduped by lowercased name (the field event uses refId =
    // planting id, the seasonal item uses items.id — they will not match
    // by id, so name is the only stable join key).
    const concrete: ForecastCalendarEventStub[] = [
      { date: "2026-07-15", name: "Tomato" },
    ];
    const seasonal: SeasonalItemRow[] = [
      { id: "tom-id", name: "Tomato", category: "fruit_veg", seasonal_months: [7, 8] },
    ];
    const result = monthDensity(2026, { past: [], concrete: concrete as any, seasonal });
    expect(result[6]?.count).toBe(1); // Tomato counted once for July
  });

  it("past zone wins when month has both past and concrete", () => {
    const concrete: ForecastCalendarEventStub[] = [
      { date: "2026-06-09", name: "Cherry tomatoes" },
    ];
    const past: WeekBucketStub[] = [
      { weekStart: "2026-05-04", items: [{ id: "rad", name: "Radish" }] },
    ];
    const result = monthDensity(2026, { past: past as any, concrete: concrete as any, seasonal: [] });
    expect(result[4]?.zone).toBe("past"); // May
    expect(result[5]?.zone).toBe("concrete"); // June
  });
});

// Stubs to keep the test file self-contained without importing the full
// ForecastCalendarEvent shape — we only need date + name to drive density.
type ForecastCalendarEventStub = { date: string; name: string };
type WeekBucketStub = { weekStart: string; items: Array<{ id: string; name: string }> };

describe("monthSeasonalItems", () => {
  const items: SeasonalItemRow[] = [
    { id: "1", name: "Tomato",   category: "fruit_veg",     seasonal_months: [7, 8] },
    { id: "2", name: "Basil",    category: "herbs_leaves",  seasonal_months: [6, 7] },
    { id: "3", name: "Marigold", category: "flowers",       seasonal_months: [7] },
    { id: "4", name: "Kale",     category: "herbs_leaves",  seasonal_months: [10] },
  ];

  it("returns items that include the requested month", () => {
    const result = monthSeasonalItems(7, items);
    const ids = Object.values(result).flat().map((i) => i.id).sort();
    expect(ids).toEqual(["1", "2", "3"]);
  });

  it("groups by category", () => {
    const result = monthSeasonalItems(7, items);
    expect(Object.keys(result).sort()).toEqual(["flowers", "fruit_veg", "herbs_leaves"]);
    expect(result.flowers?.map((i) => i.name)).toEqual(["Marigold"]);
    expect(result.fruit_veg?.map((i) => i.name)).toEqual(["Tomato"]);
    expect(result.herbs_leaves?.map((i) => i.name)).toEqual(["Basil"]);
  });

  it("returns empty object when no items match", () => {
    expect(monthSeasonalItems(1, items)).toEqual({});
  });

  it("sorts items within each category by name", () => {
    const more: SeasonalItemRow[] = [
      ...items,
      { id: "5", name: "Sungold", category: "fruit_veg", seasonal_months: [7] },
    ];
    const result = monthSeasonalItems(7, more);
    expect(result.fruit_veg?.map((i) => i.name)).toEqual(["Sungold", "Tomato"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/forecasting/yearView.test.ts`
Expected: 9 fails (5 still passing from Task 3, 9 new failing).

- [ ] **Step 3: Add the two functions to `src/lib/forecasting/yearView.ts`**

Append to the file:

```typescript
/**
 * Per-month density across all three data zones for a given calendar year.
 *
 * Returns a 12-element array (month 1..12) with the distinct-item count
 * deduplicated across zones (an item present in both concrete and seasonal
 * counts once for that month). Zone label is the highest-priority zone
 * touching the month — priority order: past > concrete > seasonal > empty.
 * Past anchors months that contain delivery weeks; concrete anchors months
 * that contain a forecast window; seasonal anchors months only listed via
 * items.seasonal_months. "empty" means no data of any kind for the month.
 *
 * The "past anchors" rule treats month-of-today and earlier as past zone
 * even if some concrete window also extends into them.
 */
export function monthDensity(
  year: number,
  sources: {
    past: WeekBucket[];
    concrete: ForecastCalendarEvent[];
    seasonal: SeasonalItemRow[];
  },
): MonthDensity[] {
  // Map<month1..12, Set<itemId>>
  const itemsByMonth = new Map<number, Set<string>>();
  // Map<month1..12, Set<zone>>
  const zonesByMonth = new Map<number, Set<MonthDensity["zone"]>>();

  function add(month: number, itemId: string, zone: "past" | "concrete" | "seasonal") {
    if (month < 1 || month > 12) return;
    let s = itemsByMonth.get(month);
    if (!s) { s = new Set(); itemsByMonth.set(month, s); }
    s.add(itemId);
    let z = zonesByMonth.get(month);
    if (!z) { z = new Set(); zonesByMonth.set(month, z); }
    z.add(zone);
  }

  // Past — every week that falls in the target year contributes its items.
  for (const week of sources.past) {
    const d = new Date(week.weekStart + "T00:00:00Z");
    if (d.getUTCFullYear() !== year) continue;
    const month = d.getUTCMonth() + 1;
    for (const it of week.items) add(month, it.id, "past");
  }

  // Concrete — each forecast event covers months from windowStart..windowEnd.
  for (const ev of sources.concrete) {
    const start = new Date(ev.windowStart + "T00:00:00Z");
    const end = new Date(ev.windowEnd + "T00:00:00Z");
    const startYear = start.getUTCFullYear();
    const endYear = end.getUTCFullYear();
    if (startYear > year || endYear < year) continue;
    const firstMonth = startYear < year ? 1 : start.getUTCMonth() + 1;
    const lastMonth = endYear > year ? 12 : end.getUTCMonth() + 1;
    for (let m = firstMonth; m <= lastMonth; m++) add(m, ev.itemId, "concrete");
  }

  // Seasonal — each item populates its listed months for THIS year.
  for (const item of sources.seasonal) {
    for (const m of item.seasonal_months) add(m, item.id, "seasonal");
  }

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const items = itemsByMonth.get(month);
    const zones = zonesByMonth.get(month);
    let zone: MonthDensity["zone"] = "empty";
    if (zones) {
      if (zones.has("past")) zone = "past";
      else if (zones.has("concrete")) zone = "concrete";
      else if (zones.has("seasonal")) zone = "seasonal";
    }
    return { month, count: items?.size ?? 0, zone };
  });
}

/**
 * Items typically available in a given month, grouped by category.
 *
 * Input items are filtered to those whose seasonal_months array contains the
 * requested month, then bucketed by `category` (null categories go into an
 * "uncategorized" bucket). Within each bucket items are sorted by name.
 */
export function monthSeasonalItems(
  month: number,
  items: SeasonalItemRow[],
): Record<string, Array<{ id: string; name: string; category: string | null }>> {
  const out: Record<string, Array<{ id: string; name: string; category: string | null }>> = {};
  for (const it of items) {
    if (!it.seasonal_months.includes(month)) continue;
    const key = it.category ?? "uncategorized";
    if (!out[key]) out[key] = [];
    out[key].push({ id: it.id, name: it.name, category: it.category });
  }
  for (const arr of Object.values(out)) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/forecasting/yearView.test.ts`
Expected: PASS, 14 specs total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/forecasting/yearView.ts tests/lib/forecasting/yearView.test.ts
git commit -m "$(cat <<'EOF'
feat(forecasting): monthDensity + monthSeasonalItems pure compute

Per-month deduplicated counts across past/concrete/seasonal zones with
priority-ordered zone labels (past > concrete > seasonal > empty), plus
category-grouped seasonal-items lookup for far-future months.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Fetch helpers — `fetchHistoricalDeliveries` + `fetchSeasonalItems`

**Files:**
- Modify: `src/lib/forecasting/fetch.ts`
- Modify: `src/lib/forecasting/index.ts`

- [ ] **Step 1: Append to `src/lib/forecasting/fetch.ts`**

```typescript
// (existing imports stay)
import type { HistoricalDeliveryRow, SeasonalItemRow } from "./types";

/**
 * Past delivery actuals for a single restaurant within [from, to].
 * Uses the admin client (bypasses RLS); the caller must have already
 * verified the chef is mapped to this restaurant.
 */
export async function fetchHistoricalDeliveries(
  from: string,
  to: string,
  restaurantId: string,
): Promise<HistoricalDeliveryRow[]> {
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("delivery_items")
    .select(`
      quantity,
      unit,
      items!inner ( id, name, category, unit_type ),
      deliveries!inner ( delivery_date, restaurant_id )
    `)
    .gte("deliveries.delivery_date", from)
    .lte("deliveries.delivery_date", to)
    .eq("deliveries.restaurant_id", restaurantId);

  if (error) {
    console.error("[forecasting] fetchHistoricalDeliveries error:", error);
    return [];
  }
  if (!data) return [];

  return data.map((row: any) => ({
    delivery_date: row.deliveries.delivery_date,
    item_id: row.items.id,
    item_name: row.items.name,
    category: row.items.category,
    unit_type: row.items.unit_type,
    quantity: Number(row.quantity),
    unit: row.unit,
  }));
}

/**
 * All non-archived items with non-empty seasonal_months. Single farm
 * assumption — the items table is single-farm in this app.
 */
export async function fetchSeasonalItems(): Promise<SeasonalItemRow[]> {
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("items")
    .select("id, name, category, seasonal_months")
    .eq("is_archived", false)
    .not("seasonal_months", "eq", "{}");

  if (error) {
    console.error("[forecasting] fetchSeasonalItems error:", error);
    return [];
  }
  if (!data) return [];

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    seasonal_months: row.seasonal_months ?? [],
  }));
}
```

**Note:** if `createAdminClient` isn't already imported at the top of `fetch.ts`, add it: `import { createAdminClient } from "@/lib/supabase/admin";` (only if not already present — check with `grep "createAdminClient" src/lib/forecasting/fetch.ts`).

- [ ] **Step 2: Add to exports in `src/lib/forecasting/index.ts`**

Find the existing `export { ... } from "./fetch"` block and add the two new names.

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/forecasting/fetch.ts src/lib/forecasting/index.ts
git commit -m "$(cat <<'EOF'
feat(forecasting): add historical + seasonal fetch helpers

fetchHistoricalDeliveries(from, to, restaurantId) — past deliveries for
one restaurant; fetchSeasonalItems() — items with non-empty
seasonal_months for the far-future zone.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Drawer content components

**Files:**
- Create: `src/components/order/forecast/PastWeekDetail.tsx`
- Create: `src/components/order/forecast/ConcreteWeekDetail.tsx`
- Create: `src/components/order/forecast/SeasonalMonthDetail.tsx`

All three are pure presentational client components — pure functions of props, no state, no fetching. They render the three drawer shapes from the spec.

- [ ] **Step 1: Create `PastWeekDetail.tsx`**

```tsx
"use client";

import type { WeekBucket } from "@/lib/forecasting/types";

interface Props {
  bucket: WeekBucket | null;
}

function formatWeekHeading(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatQty(q: number, unit: string): string {
  const rounded = Math.round(q * 100) / 100;
  return `${rounded} ${unit}`;
}

/**
 * Past-zone drawer content: single ungrouped list of what was delivered.
 */
export function PastWeekDetail({ bucket }: Props) {
  if (!bucket || bucket.items.length === 0) {
    return (
      <p className="text-sm text-farm-muted py-6 text-center">
        No deliveries this week.
      </p>
    );
  }
  return (
    <div className="space-y-1">
      <h3 className="text-[11px] tracking-[0.18em] uppercase text-pf-master-gold mb-2">
        Delivered week of {formatWeekHeading(bucket.weekStart)}
      </h3>
      <ul className="divide-y divide-pf-master-gold/15">
        {bucket.items.map((it) => (
          <li key={it.id} className="py-2 flex items-center justify-between">
            <span className="text-sm text-farm-dark">{it.name}</span>
            <span className="text-xs text-farm-muted">{formatQty(it.quantity, it.unit)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Create `ConcreteWeekDetail.tsx`**

```tsx
"use client";

import type { ForecastCalendarEvent } from "@/lib/forecasting/types";

interface Props {
  weekStart: string;
  events: ForecastCalendarEvent[];
}

function formatWeekHeading(weekStart: string): string {
  const d = new Date(weekStart + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatWindow(start: string, end: string): string {
  const s = new Date(start + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = new Date(end + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return s === e ? s : `${s} – ${e}`;
}

/**
 * Concrete-zone drawer content: two subsections (field crops / microgreens).
 */
export function ConcreteWeekDetail({ weekStart, events }: Props) {
  const field = events.filter((e) => e.source === "field");
  const micro = events.filter((e) => e.source === "microgreen");

  if (field.length === 0 && micro.length === 0) {
    return (
      <p className="text-sm text-farm-muted py-6 text-center">
        Nothing harvesting this week.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-[11px] tracking-[0.18em] uppercase text-pf-master-gold">
        Harvesting week of {formatWeekHeading(weekStart)}
      </h3>

      {field.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-farm-dark mb-2">Field crops</h4>
          <ul className="divide-y divide-pf-master-gold/15">
            {field.map((ev) => (
              <li key={ev.id} className="py-2 flex items-center justify-between gap-2">
                <span className="text-sm text-farm-dark">{ev.label}</span>
                <span className="text-xs text-farm-muted whitespace-nowrap">
                  {formatWindow(ev.windowStart, ev.windowEnd)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {micro.length > 0 && (
        <section>
          <h4 className="text-sm font-semibold text-pf-master-gold mb-2">Microgreens</h4>
          <ul className="divide-y divide-pf-master-gold/15">
            {micro.map((ev) => (
              <li key={ev.id} className="py-2 flex items-center justify-between gap-2">
                <span className="text-sm text-farm-dark">
                  {ev.label}
                  {ev.trays != null && (
                    <span className="ml-2 text-xs text-farm-muted">· {ev.trays} trays</span>
                  )}
                </span>
                <span className="text-xs text-farm-muted whitespace-nowrap">
                  harvest {formatWindow(ev.windowStart, ev.windowEnd)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

**Note on `ev.trays`:** the existing `ForecastCalendarEvent` type may not have a `trays` field. Verify by grepping `src/lib/forecasting/types.ts` for `ForecastCalendarEvent`. If absent, add `trays?: number | null` to that interface and update `microgreenEventsInRange` in `compute.ts` to populate it from `batch.tray_count`. Keep that change minimal — one field.

- [ ] **Step 3: Create `SeasonalMonthDetail.tsx`**

```tsx
"use client";

import { ITEM_CATEGORIES } from "@/lib/constants";

interface Props {
  month: number;
  grouped: Record<string, Array<{ id: string; name: string; category: string | null }>>;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function categoryLabel(key: string): string {
  const match = ITEM_CATEGORIES.find((c: { value: string; label: string }) => c.value === key);
  return match?.label ?? key.replace(/_/g, " ");
}

/**
 * Seasonal-zone drawer content: category-grouped list of typical items
 * with no window dates.
 */
export function SeasonalMonthDetail({ month, grouped }: Props) {
  const sections = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  if (sections.length === 0) {
    return (
      <p className="text-sm text-farm-muted py-6 text-center">
        No items typical for {MONTH_NAMES[month - 1]} yet — admin still
        filling in seasonality.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <h3 className="text-[11px] tracking-[0.18em] uppercase text-pf-master-gold">
        Typically available in {MONTH_NAMES[month - 1]}
      </h3>

      {sections.map(([catKey, items]) => (
        <section key={catKey}>
          <h4 className="text-sm font-semibold text-farm-dark mb-2">
            {categoryLabel(catKey)}
          </h4>
          <ul className="divide-y divide-pf-master-gold/15">
            {items.map((it) => (
              <li key={it.id} className="py-2 flex items-center gap-2">
                <span className="text-sm text-farm-dark flex-1">{it.name}</span>
                <span className="text-[9px] tracking-[0.14em] uppercase text-pf-master-gold border border-pf-master-gold/50 rounded-full px-2 py-0.5">
                  Typical
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: build passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/order/forecast/PastWeekDetail.tsx src/components/order/forecast/ConcreteWeekDetail.tsx src/components/order/forecast/SeasonalMonthDetail.tsx src/lib/forecasting/types.ts src/lib/forecasting/compute.ts
git commit -m "$(cat <<'EOF'
feat(forecast): three zone-specific drawer content components

PastWeekDetail (delivery actuals list), ConcreteWeekDetail (field +
microgreen subsections with window dates), SeasonalMonthDetail
(category-grouped typical-availability list with "Typical" badges).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `YearMonthTabs`, `WeekStrip`, `DetailDrawer`

**Files:**
- Create: `src/components/order/forecast/YearMonthTabs.tsx`
- Create: `src/components/order/forecast/WeekStrip.tsx`
- Create: `src/components/order/forecast/DetailDrawer.tsx`

- [ ] **Step 1: Create `YearMonthTabs.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { MonthDensity } from "@/lib/forecasting/types";

interface Props {
  densities: MonthDensity[]; // length 12
  selectedMonth: number;     // 1..12
  currentMonth: number;      // 1..12 (today's month)
  onSelect: (month: number) => void;
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function dotsFor(count: number): string {
  if (count <= 0) return "";
  if (count <= 2) return "●●";
  if (count <= 4) return "●●●";
  return "●●●●●";
}

function tabClasses(d: MonthDensity, isSelected: boolean, isCurrent: boolean): string {
  const base = "min-w-[58px] py-2 px-2 rounded-md text-center transition-colors tap-highlight-none";
  if (isSelected) {
    return `${base} bg-farm-green text-white font-semibold`;
  }
  if (isCurrent) {
    return `${base} border border-farm-green text-farm-green`;
  }
  switch (d.zone) {
    case "past":
      return `${base} bg-farm-cream text-pf-master-gold`;
    case "concrete":
      return `${base} bg-farm-cream text-farm-green`;
    case "seasonal":
      return `${base} bg-farm-cream/60 text-pf-master-gold italic`;
    case "empty":
    default:
      return `${base} text-farm-muted`;
  }
}

export function YearMonthTabs({ densities, selectedMonth, currentMonth, onSelect }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the current month into view on mount.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLButtonElement>(
      `button[data-month="${currentMonth}"]`,
    );
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "auto" });
  }, [currentMonth]);

  return (
    <div
      ref={stripRef}
      className="flex gap-1.5 overflow-x-auto px-4 pb-2 -mx-1 scrollbar-thin"
      role="tablist"
      aria-label="Months"
    >
      {densities.map((d) => {
        const isSelected = d.month === selectedMonth;
        const isCurrent = d.month === currentMonth && !isSelected;
        return (
          <button
            key={d.month}
            type="button"
            role="tab"
            aria-selected={isSelected}
            data-month={d.month}
            onClick={() => onSelect(d.month)}
            className={tabClasses(d, isSelected, isCurrent)}
          >
            <div className="text-[11px] leading-tight">{MONTH_LABELS[d.month - 1]}</div>
            <div className="text-[10px] leading-tight mt-0.5" aria-hidden="true">
              {dotsFor(d.count)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `WeekStrip.tsx`**

```tsx
"use client";

import type { ForecastCalendarEvent, WeekBucket } from "@/lib/forecasting/types";

interface WeekInfo {
  weekStart: string;       // ISO Monday
  label: string;           // "Wk 2"
  shortDate: string;       // "Jun 9"
  count: number;           // distinct items
}

interface Props {
  weeks: WeekInfo[];
  selectedWeekStart: string | null;
  onSelect: (weekStart: string) => void;
}

function dotsFor(count: number): string {
  if (count <= 0) return "—";
  if (count <= 2) return "●●";
  if (count <= 4) return "●●●";
  return "●●●●";
}

export function WeekStrip({ weeks, selectedWeekStart, onSelect }: Props) {
  if (weeks.length === 0) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto px-4 pb-3" aria-label="Weeks">
      {weeks.map((w, i) => {
        const isSelected = w.weekStart === selectedWeekStart;
        const cls = isSelected
          ? "min-w-[64px] bg-farm-cream border-2 border-pf-master-gold rounded-md py-2 px-2 text-center font-semibold"
          : "min-w-[64px] bg-white border border-pf-master-gold/20 rounded-md py-2 px-2 text-center";
        return (
          <button
            key={w.weekStart}
            type="button"
            onClick={() => onSelect(w.weekStart)}
            className={cls}
            aria-pressed={isSelected}
          >
            <div className="text-[10px] text-pf-master-gold uppercase tracking-wider">
              {w.shortDate}
            </div>
            <div className="text-[11px] text-farm-dark mt-0.5">Wk {i + 1}</div>
            <div className="text-[12px] text-farm-green leading-none mt-1" aria-hidden="true">
              {dotsFor(w.count)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create `DetailDrawer.tsx`**

```tsx
"use client";

import type { ForecastCalendarEvent, WeekBucket, SeasonalItemRow, MonthDensity } from "@/lib/forecasting/types";
import { PastWeekDetail } from "./PastWeekDetail";
import { ConcreteWeekDetail } from "./ConcreteWeekDetail";
import { SeasonalMonthDetail } from "./SeasonalMonthDetail";
import { monthSeasonalItems } from "@/lib/forecasting/yearView";

interface Props {
  zone: MonthDensity["zone"];
  selectedMonth: number;
  selectedWeekStart: string | null;
  pastWeek: WeekBucket | null;
  concreteEvents: ForecastCalendarEvent[];
  seasonalItems: SeasonalItemRow[];
}

/**
 * Routes drawer content based on zone + selection state. The page passes the
 * raw three-zone data; this component picks the right child.
 */
export function DetailDrawer({
  zone,
  selectedMonth,
  selectedWeekStart,
  pastWeek,
  concreteEvents,
  seasonalItems,
}: Props) {
  return (
    <div className="bg-white border border-pf-master-gold/30 rounded-lg p-4 mx-4 mt-1">
      {zone === "past" && <PastWeekDetail bucket={pastWeek} />}

      {zone === "concrete" && (
        <ConcreteWeekDetail
          weekStart={selectedWeekStart ?? ""}
          events={concreteEvents}
        />
      )}

      {(zone === "seasonal" || zone === "empty") && (
        <SeasonalMonthDetail
          month={selectedMonth}
          grouped={monthSeasonalItems(selectedMonth, seasonalItems)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: passes. If TypeScript flags a missing `trays` field on `ForecastCalendarEvent`, add it as `trays?: number | null` in `src/lib/forecasting/types.ts` (the type that backs `microgreenEventsInRange`) and have that function set it from `batch.tray_count`.

- [ ] **Step 5: Commit**

```bash
git add src/components/order/forecast/YearMonthTabs.tsx src/components/order/forecast/WeekStrip.tsx src/components/order/forecast/DetailDrawer.tsx
git commit -m "$(cat <<'EOF'
feat(forecast): year-month tabs, week strip, zone-aware drawer

Three interactive shells: month tabs (with density dots + zone-tinted
states), conditional week strip, and the drawer router that picks
between Past / Concrete / Seasonal detail children.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `ForecastClient` + `page.tsx`

**Files:**
- Create: `src/app/order/forecast/ForecastClient.tsx`
- Create: `src/app/order/forecast/page.tsx`

- [ ] **Step 1: Create `ForecastClient.tsx`**

```tsx
"use client";

import { useState, useMemo } from "react";
import { YearMonthTabs } from "@/components/order/forecast/YearMonthTabs";
import { WeekStrip } from "@/components/order/forecast/WeekStrip";
import { DetailDrawer } from "@/components/order/forecast/DetailDrawer";
import type {
  WeekBucket,
  ForecastCalendarEvent,
  SeasonalItemRow,
  MonthDensity,
} from "@/lib/forecasting/types";
import { monthDensity } from "@/lib/forecasting/yearView";

interface Props {
  initialYear: number;
  currentMonth: number;  // 1..12 (today)
  yearOptions: number[]; // e.g. [2025, 2026, 2027]
  data: {
    past: WeekBucket[];
    concrete: ForecastCalendarEvent[];
    seasonal: SeasonalItemRow[];
  };
}

function isoWeekStart(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ForecastClient({ initialYear, currentMonth, yearOptions, data }: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(currentMonth);
  const [weekStart, setWeekStart] = useState<string | null>(null);

  const densities = useMemo(() => monthDensity(year, data), [year, data]);

  const selectedDensity = densities[month - 1]!;
  const zone = selectedDensity.zone;

  // Weeks for the selected month, sourced from past or concrete data.
  const weeksForMonth = useMemo(() => {
    if (zone === "seasonal" || zone === "empty") return [];

    const map = new Map<string, { count: number }>();
    // From past zone
    for (const w of data.past) {
      const d = new Date(w.weekStart + "T00:00:00Z");
      if (d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month) {
        const existing = map.get(w.weekStart);
        const set = new Set(existing ? Array.from({ length: existing.count }, (_, i) => i.toString()) : []);
        for (const it of w.items) set.add(it.id);
        map.set(w.weekStart, { count: set.size });
      }
    }
    // From concrete zone — bucket events into weeks they cover.
    for (const ev of data.concrete) {
      const start = new Date(ev.windowStart + "T00:00:00Z");
      const end = new Date(ev.windowEnd + "T00:00:00Z");
      // Walk weeks Monday-by-Monday from windowStart to windowEnd.
      const cur = new Date(start);
      cur.setUTCDate(cur.getUTCDate() - ((cur.getUTCDay() + 6) % 7));
      while (cur <= end) {
        if (cur.getUTCFullYear() === year && cur.getUTCMonth() + 1 === month) {
          const wsIso = cur.toISOString().slice(0, 10);
          const existing = map.get(wsIso) ?? { count: 0 };
          map.set(wsIso, { count: existing.count + 1 });
        }
        cur.setUTCDate(cur.getUTCDate() + 7);
      }
    }

    const result = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ws, info], i) => {
        const d = new Date(ws + "T12:00:00Z");
        return {
          weekStart: ws,
          label: `Wk ${i + 1}`,
          shortDate: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          count: info.count,
        };
      });
    return result;
  }, [zone, data.past, data.concrete, year, month]);

  // Auto-select first week when month changes, only for past/concrete zones.
  const effectiveWeekStart =
    zone === "past" || zone === "concrete"
      ? (weekStart && weeksForMonth.some((w) => w.weekStart === weekStart)
          ? weekStart
          : weeksForMonth[0]?.weekStart ?? null)
      : null;

  // Past week data for drawer
  const pastWeek = effectiveWeekStart
    ? data.past.find((w) => w.weekStart === effectiveWeekStart) ?? null
    : null;

  // Concrete events overlapping the selected week
  const concreteForWeek = effectiveWeekStart
    ? data.concrete.filter((ev) => {
        const ws = effectiveWeekStart;
        const we = isoWeekStart(
          new Date(new Date(ws + "T00:00:00Z").getTime() + 6 * 86_400_000)
            .toISOString()
            .slice(0, 10),
        );
        const weekEnd = new Date(ws + "T00:00:00Z");
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        const weekEndIso = weekEnd.toISOString().slice(0, 10);
        return ev.windowEnd >= ws && ev.windowStart <= weekEndIso;
      })
    : [];

  function selectMonth(m: number) {
    setMonth(m);
    setWeekStart(null);
  }

  function shiftYear(delta: number) {
    const next = year + delta;
    if (!yearOptions.includes(next)) return;
    setYear(next);
    setWeekStart(null);
  }

  return (
    <div className="pb-12">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => shiftYear(-1)}
          disabled={!yearOptions.includes(year - 1)}
          className="min-w-[40px] min-h-[40px] flex items-center justify-center text-farm-muted disabled:opacity-30"
          aria-label="Previous year"
        >
          ‹
        </button>
        <div
          className="text-2xl text-farm-dark"
          style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
          {year}
        </div>
        <button
          type="button"
          onClick={() => shiftYear(1)}
          disabled={!yearOptions.includes(year + 1)}
          className="min-w-[40px] min-h-[40px] flex items-center justify-center text-farm-muted disabled:opacity-30"
          aria-label="Next year"
        >
          ›
        </button>
      </div>

      <YearMonthTabs
        densities={densities}
        selectedMonth={month}
        currentMonth={year === new Date().getUTCFullYear() ? currentMonth : -1}
        onSelect={selectMonth}
      />

      {(zone === "past" || zone === "concrete") && (
        <WeekStrip
          weeks={weeksForMonth}
          selectedWeekStart={effectiveWeekStart}
          onSelect={setWeekStart}
        />
      )}

      <DetailDrawer
        zone={zone}
        selectedMonth={month}
        selectedWeekStart={effectiveWeekStart}
        pastWeek={pastWeek}
        concreteEvents={concreteForWeek}
        seasonalItems={data.seasonal}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ForecastClient } from "./ForecastClient";
import {
  fetchHistoricalDeliveries,
  fetchSeasonalItems,
  getCalendarEvents,
  historicalWeeks,
} from "@/lib/forecasting";

export const dynamic = "force-dynamic";

/**
 * /order/forecast — Chef-facing year-scope read-only availability forecast.
 *
 * Three data zones unioned in the UI: past delivery actuals (per restaurant),
 * current concrete plantings (from forecasting lib), and far-future seasonal
 * hints (from items.seasonal_months).
 */
export default async function ForecastPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: restaurantUser } = (await supabase
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name)")
    .eq("user_id", user.id)
    .single()) as any;

  if (!restaurantUser?.restaurants) {
    return (
      <main className="min-h-screen bg-farm-cream flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            No restaurant found for your account. Please contact Press Farm.
          </p>
        </div>
      </main>
    );
  }

  const restaurant = restaurantUser.restaurants;
  const todayIso = new Date().toISOString().slice(0, 10);
  const today = new Date(todayIso + "T00:00:00Z");
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;

  // ±52 weeks from today
  const fromIso = new Date(today.getTime() - 52 * 7 * 86_400_000).toISOString().slice(0, 10);
  const toIso = new Date(today.getTime() + 52 * 7 * 86_400_000).toISOString().slice(0, 10);

  // Fetch the three zones in parallel.
  const [pastRows, concreteEvents, seasonalItems] = await Promise.all([
    fetchHistoricalDeliveries(fromIso, todayIso, restaurant.id),
    getCalendarEvents(todayIso, toIso),
    fetchSeasonalItems(),
  ]);

  const past = historicalWeeks(fromIso, todayIso, pastRows);

  return (
    <main className="min-h-screen bg-farm-cream">
      <header className="page-header">
        <h1 className="page-title">Forecast</h1>
        <p className="text-base sm:text-sm font-semibold sm:font-medium text-white/90">
          {restaurant.name}
        </p>
      </header>

      <ForecastClient
        initialYear={currentYear}
        currentMonth={currentMonth}
        yearOptions={[currentYear - 1, currentYear, currentYear + 1]}
        data={{ past, concrete: concreteEvents, seasonal: seasonalItems }}
      />
    </main>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build 2>&1 | tail -15`
Expected: build passes, output shows `ƒ /order/forecast` in the route list.

- [ ] **Step 4: Commit**

```bash
git add src/app/order/forecast/page.tsx src/app/order/forecast/ForecastClient.tsx
git commit -m "$(cat <<'EOF'
feat(order): /order/forecast page with year navigation

Server component does auth + restaurant lookup + three parallel zone
fetches. Client component holds year/month/week selection and renders
YearMonthTabs → conditional WeekStrip → DetailDrawer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Page smoke tests

**Files:**
- Create: `tests/app/order/forecast/page.test.tsx`

We test only the three auth/data branches — full UI behavior is not in scope per the spec. Server-component testing needs the Supabase clients mocked.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Next's redirect to throw a marker error we can assert on.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const getUserMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

vi.mock("@/lib/forecasting", () => ({
  fetchHistoricalDeliveries: vi.fn().mockResolvedValue([]),
  fetchSeasonalItems: vi.fn().mockResolvedValue([]),
  getCalendarEvents: vi.fn().mockResolvedValue([]),
  historicalWeeks: vi.fn().mockReturnValue([]),
}));

import ForecastPage from "@/app/order/forecast/page";

beforeEach(() => {
  getUserMock.mockReset();
  fromMock.mockReset();
});

describe("/order/forecast page", () => {
  it("redirects to /login when unauthenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    await expect(ForecastPage()).rejects.toThrow("REDIRECT:/login");
  });

  it("renders 'No restaurant' message when user has no restaurant_users row", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: null }) }),
      }),
    });
    const result = await ForecastPage();
    const html = JSON.stringify(result);
    expect(html).toContain("No restaurant found");
  });

  it("renders Forecast header when authenticated chef has a restaurant", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "u1" } } });
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: {
              restaurant_id: "r1",
              restaurants: { id: "r1", name: "Press" },
            },
          }),
        }),
      }),
    });
    const result = await ForecastPage();
    const html = JSON.stringify(result);
    expect(html).toContain("Forecast");
    expect(html).toContain("Press");
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/app/order/forecast/page.test.tsx`
Expected: 3 specs pass.

- [ ] **Step 3: Run the full test suite**

Run: `npm test 2>&1 | tail -10`
Expected: all tests pass (previously 81 + ~17 new = ~98).

- [ ] **Step 4: Commit**

```bash
git add tests/app/order/forecast/page.test.tsx
git commit -m "$(cat <<'EOF'
test(forecast): smoke tests for /order/forecast page

Three branches: unauthenticated → redirect, no-restaurant → graceful
message, authenticated chef → header + restaurant name in output.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Admin items — `seasonal_months` chip editor

**Files:**
- Modify: `src/app/admin/items/[itemId]/ItemForm.tsx`
- Modify: the items PATCH endpoint (grep `src/app/api/items` for the file that updates an item; typically `src/app/api/items/[itemId]/route.ts`)

- [ ] **Step 1: Find the PATCH handler**

Run: `grep -rn "update.*items\|UPDATE.*items\|.from(\"items\")" src/app/api/items 2>&1`
Note the file and line numbers. That handler must whitelist `seasonal_months` in the allowed-update field set.

- [ ] **Step 2: Extend the `Item` interface in `ItemForm.tsx`**

In `src/app/admin/items/[itemId]/ItemForm.tsx`, add to the `Item` interface (near line 9–30):

```typescript
  seasonal_months?: number[];
```

And to the initial state default for the form (in the `useState` block):

```typescript
    seasonal_months: item?.seasonal_months ?? [],
```

- [ ] **Step 3: Add the chip UI**

In the JSX of `ItemForm.tsx`, find a location near other category-style fields (around the existing `category` or `season_status` form rows) and add:

```tsx
{/* Seasonal months — when this item is typically available */}
<div className="mb-4">
  <label className="block text-sm font-medium text-farm-dark mb-1.5">
    Typical season
  </label>
  <p className="text-xs text-farm-muted mb-2">
    Tap months when this item is typically available. Fills in the chef
    forecast page for months we have no concrete planted data yet.
  </p>
  <div className="flex flex-wrap gap-1.5">
    {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((label, i) => {
      const m = i + 1;
      const isOn = form.seasonal_months.includes(m);
      return (
        <button
          key={m}
          type="button"
          onClick={() => {
            setForm((f: any) => ({
              ...f,
              seasonal_months: isOn
                ? f.seasonal_months.filter((x: number) => x !== m)
                : [...f.seasonal_months, m].sort((a: number, b: number) => a - b),
            }));
          }}
          className={
            isOn
              ? "min-w-[44px] min-h-[36px] px-2.5 rounded-full text-xs font-semibold bg-farm-green text-white"
              : "min-w-[44px] min-h-[36px] px-2.5 rounded-full text-xs border border-pf-master-gold/40 text-farm-muted"
          }
          aria-pressed={isOn}
        >
          {label}
        </button>
      );
    })}
  </div>
</div>
```

Verify by searching the file: the form's `setForm` is typed loosely (`any`) — that's the existing pattern, don't tighten it.

- [ ] **Step 4: Persist on save**

In the same file, find the `onSubmit` / save handler. Confirm that the PATCH body it sends to the API includes `seasonal_months: form.seasonal_months`. If the handler does an explicit field-by-field POST body, add the line. If it spreads form state, it's already covered.

- [ ] **Step 5: Update the PATCH endpoint allowed-field set**

In the API route from Step 1, ensure `seasonal_months` is in any allow-list of updatable fields. If the endpoint just passes through the whole body, no change needed.

- [ ] **Step 6: Verify build**

Run: `npm run build 2>&1 | tail -10`
Expected: passes.

- [ ] **Step 7: Manual smoke (optional but recommended)**

Start dev server: `npm run dev`. Navigate to any item edit page at `/admin/items/<id>`. Toggle a few month chips. Save. Reload. Verify the chips persist (the `items.seasonal_months` column should now contain the selected month numbers).

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/items/[itemId]/ItemForm.tsx src/app/api/items/
git commit -m "$(cat <<'EOF'
feat(admin/items): seasonal_months chip selector

Twelve month chips on each item edit page. Persists to
items.seasonal_months. Powers the seasonal zone of the new
/order/forecast page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Final build + push + sanity check

- [ ] **Step 1: Run the full test suite**

Run: `npm test 2>&1 | tail -10`
Expected: all green.

- [ ] **Step 2: Run the production build**

Run: `npm run build 2>&1 | tail -20`
Expected: build passes, route `/order/forecast` appears in the output.

- [ ] **Step 3: Confirm migration 059 is applied in Supabase prod**

Ask the user: "Confirm migration 059 ran in the web SQL editor before I push? If you ran it earlier, just say yes."

If not yet run, stop here and have the user run it before pushing.

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

This triggers a Vercel deploy. The push has 9 commits — one for the migration file, eight for the feature.

- [ ] **Step 5: Watch the Vercel deploy**

Tell the user to watch https://vercel.com/micheal-breedloves-projects/press-farm-os. When the deploy goes green, the chef can visit `https://pressfarm.app/order/forecast`.

- [ ] **Step 6: Verify in production (smoke)**

Ask user to:
1. Visit `/order/forecast` while logged in as a chef
2. Confirm month tabs render, current month is selected
3. Tap a past month → past-week drawer should show real delivery history
4. Tap a far-future month → "Typically available in [month]" with seed-populated chips
5. Visit `/admin/items/<id>` and confirm chip selector appears and saves

- [ ] **Step 7: Final status comment**

Post a short status update to peer-bus (per CLAUDE.md convention) summarizing what shipped, the migration that was run, and the new admin field chefs/admin should know about.

---

## Self-review notes

**Spec coverage:** Every spec section has a task:
- §Data sources → Tasks 3, 4, 5
- §Schema change → Task 1
- §Library → Tasks 3–5
- §UI page anatomy → Tasks 6–8
- §Admin entry → Task 10
- §Testing → Tasks 3, 4, 9

**Open question resolutions (from spec):**
- "Exact name of admin items editor file" → resolved: `src/app/admin/items/[itemId]/ItemForm.tsx`
- "Whether `WeekBucket` should reuse `ForecastCalendarEvent` or be its own type" → resolved: its own type (richer, includes quantity/unit for past actuals)
- "ISO-week math: reuse `dates.ts` or import a lib" → resolved: reuse `dates.ts` helpers + one local `isoWeekStart()` function

**Type consistency:** `historicalWeeks`/`monthDensity`/`monthSeasonalItems` signatures match between Tasks 3, 4, and the consumers in Tasks 7, 8. `WeekBucket.items[].id` (not `itemId`) is used consistently.

**Sequencing constraint:** Task 1's migration must be applied in Supabase before Tasks 2–10's code lands in prod (it references `items.seasonal_months`). The plan keeps everything local until Task 11 Step 3 confirms migration applied.
