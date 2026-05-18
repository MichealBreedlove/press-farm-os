# Microgreen Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin/microgreens` production module per [the design spec](../specs/2026-05-17-microgreen-manager-design.md) — variety library, manual demand targets, sow-plan algorithm, tray-level ops, harvest event log, calendar view, and forecast warnings.

**Architecture:** New top-level admin module with five new tables (migration 045), linked to existing `items` via `microgreen_crops.item_id`. Pure-logic modules (sowPlan, stages, forecast, trayLabel) get full Vitest TDD coverage. API routes + UI verified via Vitest with mocked Supabase client.

**Tech Stack:** Next.js 14 App Router · TypeScript strict · Supabase (PostgreSQL 15) · Tailwind · Vitest (new) · existing `EditorialHero`, `FloralCorners`, `farm-*` / `pf-*` tokens.

---

## File Structure

```
supabase/migrations/045_microgreens_module.sql          (NEW)
scripts/microgreen-seed-review.ts                       (NEW — emits review CSV)

src/lib/microgreens/
  types.ts                  (NEW — shared TS types)
  constants.ts              (NEW — enums, defaults)
  stages.ts                 (NEW — pure stage transition logic)
  trayLabel.ts              (NEW — auto-label generator)
  forecast.ts               (NEW — rolling 8-wk demand math)
  sowPlan.ts                (NEW — backward-schedule algorithm)
  seedData.ts               (NEW — ~70 variety library seed array)

src/types/database.ts       (MODIFY — add Microgreen* table types)
src/types/index.ts          (MODIFY — enriched join shapes)

src/app/api/microgreens/
  crops/route.ts            (NEW — GET list, POST create)
  crops/[id]/route.ts       (NEW — GET, PATCH, DELETE)
  demand/route.ts           (NEW — GET, POST)
  demand/[id]/route.ts      (NEW — PATCH, DELETE)
  sow-plan/route.ts         (NEW — GET computed plan)
  batches/route.ts          (NEW — POST sow event)
  batches/[id]/route.ts     (NEW — GET)
  trays/[id]/route.ts       (NEW — GET, PATCH)
  trays/[id]/advance/route.ts    (NEW — POST stage advance)
  trays/[id]/terminate/route.ts  (NEW — POST terminate)
  harvests/route.ts         (NEW — GET log, POST event)
  harvests/[id]/route.ts    (NEW — DELETE)

src/app/admin/microgreens/
  page.tsx                  (NEW — dashboard, the "what to sow today" screen)
  crops/page.tsx            (NEW — variety list)
  crops/new/page.tsx        (NEW — create crop)
  crops/[id]/page.tsx       (NEW — edit crop)
  demand/page.tsx           (NEW — weekly targets grid)
  calendar/page.tsx         (NEW — month/week/day view)
  trays/page.tsx            (NEW — tray list with filters)
  trays/[id]/page.tsx       (NEW — tray detail + harvest history)
  batches/[id]/page.tsx     (NEW — batch detail)
  harvests/page.tsx         (NEW — harvest event log)

src/components/admin/microgreens/
  TaskCard.tsx              (NEW — sow/advance/harvest cards on dashboard)
  SowModal.tsx              (NEW — sow event form)
  HarvestForm.tsx           (NEW — harvest event form)
  StageTimeline.tsx         (NEW — visual stage indicator)
  StageBadge.tsx            (NEW — status badge)
  DemandGrid.tsx            (NEW — inline-editable grid)
  CalendarView.tsx          (NEW — calendar component)
  CropForm.tsx              (NEW — crop editor form)

src/components/admin/BottomNav.tsx    (MODIFY — add "Micro" entry)

tests/lib/microgreens/
  stages.test.ts            (NEW)
  trayLabel.test.ts         (NEW)
  forecast.test.ts          (NEW)
  sowPlan.test.ts           (NEW)
tests/api/microgreens/
  crops.test.ts             (NEW)
  demand.test.ts            (NEW)
  sow-plan.test.ts          (NEW)
  batches.test.ts           (NEW)
  trays-advance.test.ts     (NEW)
  harvests.test.ts          (NEW)
tests/helpers/
  supabase-mock.ts          (NEW)

vitest.config.ts            (NEW)
package.json                (MODIFY — add vitest devDeps + test script)
tsconfig.json               (MODIFY — add tests/ to include if needed)
```

---

## Task 1: Set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/helpers/supabase-mock.ts`

- [ ] **Step 1: Install Vitest devDeps**

```bash
npm install --save-dev vitest @vitest/ui @vitejs/plugin-react vitest-mock-extended
```

- [ ] **Step 2: Add test script to `package.json`**

In `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Create `tests/helpers/supabase-mock.ts`**

```ts
import { vi } from "vitest";

type Row = Record<string, any>;

/**
 * Lightweight Supabase client mock. Supports the subset of the query-builder
 * used by route handlers: from().select().eq().order().single().maybeSingle()
 * and from().insert().select().single() / .update() / .delete().
 *
 * Tests pre-seed data with `seed(table, rows)` and inspect captured calls.
 */
export function makeSupabaseMock(initialData: Record<string, Row[]> = {}) {
  const data: Record<string, Row[]> = JSON.parse(JSON.stringify(initialData));
  const calls: Array<{ table: string; op: string; payload?: any }> = [];

  const builder = (table: string) => {
    let rows = data[table] ?? [];
    let filterFns: Array<(r: Row) => boolean> = [];

    const api: any = {
      select: vi.fn(() => api),
      insert: vi.fn((payload: Row | Row[]) => {
        const list = Array.isArray(payload) ? payload : [payload];
        const inserted = list.map((r) => ({ id: crypto.randomUUID(), ...r }));
        data[table] = [...(data[table] ?? []), ...inserted];
        calls.push({ table, op: "insert", payload: inserted });
        rows = inserted;
        return api;
      }),
      update: vi.fn((payload: Row) => {
        rows = rows.filter((r) => filterFns.every((fn) => fn(r)))
          .map((r) => ({ ...r, ...payload }));
        calls.push({ table, op: "update", payload });
        return api;
      }),
      delete: vi.fn(() => {
        const toDel = rows.filter((r) => filterFns.every((fn) => fn(r)));
        data[table] = (data[table] ?? []).filter((r) => !toDel.includes(r));
        calls.push({ table, op: "delete", payload: toDel });
        return api;
      }),
      eq: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] === val);
        return api;
      }),
      in: vi.fn((col: string, vals: any[]) => {
        filterFns.push((r) => vals.includes(r[col]));
        return api;
      }),
      gte: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] >= val);
        return api;
      }),
      lte: vi.fn((col: string, val: any) => {
        filterFns.push((r) => r[col] <= val);
        return api;
      }),
      order: vi.fn(() => api),
      limit: vi.fn(() => api),
      single: vi.fn(async () => {
        const filtered = rows.filter((r) => filterFns.every((fn) => fn(r)));
        return { data: filtered[0] ?? null, error: filtered[0] ? null : { code: "PGRST116" } };
      }),
      maybeSingle: vi.fn(async () => {
        const filtered = rows.filter((r) => filterFns.every((fn) => fn(r)));
        return { data: filtered[0] ?? null, error: null };
      }),
      then: (resolve: any) => {
        const filtered = rows.filter((r) => filterFns.every((fn) => fn(r)));
        return Promise.resolve({ data: filtered, error: null }).then(resolve);
      },
    };

    return api;
  };

  return {
    from: vi.fn(builder),
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "test-admin" } }, error: null })),
    },
    _data: data,
    _calls: calls,
    _reset: () => {
      Object.keys(data).forEach((k) => delete data[k]);
      Object.assign(data, JSON.parse(JSON.stringify(initialData)));
      calls.length = 0;
    },
  };
}

export type MockSupabase = ReturnType<typeof makeSupabaseMock>;
```

- [ ] **Step 5: Smoke-test Vitest works**

Create `tests/helpers/supabase-mock.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { makeSupabaseMock } from "./supabase-mock";

describe("supabase-mock", () => {
  it("returns seeded rows", async () => {
    const sb = makeSupabaseMock({ items: [{ id: "1", name: "Broccoli" }] });
    const { data } = await sb.from("items").select("*");
    expect(data).toEqual([{ id: "1", name: "Broccoli" }]);
  });

  it("filters with eq", async () => {
    const sb = makeSupabaseMock({ items: [{ id: "1", name: "A" }, { id: "2", name: "B" }] });
    const { data } = await sb.from("items").select("*").eq("name", "B");
    expect(data).toEqual([{ id: "2", name: "B" }]);
  });
});
```

Run: `npm test`
Expected: 2 passing tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/
git commit -m "chore: add vitest + supabase mock helper for microgreens module

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Migration 045 — schema only (no seed yet)

**Files:**
- Create: `supabase/migrations/045_microgreens_module.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration 045: Microgreens production module
-- New /admin/microgreens module — variety library, demand, batches, trays, harvest events.
-- Linked to existing items via microgreen_crops.item_id.

-- Enum for tray status
CREATE TYPE microgreen_tray_status AS ENUM (
  'soaking', 'blackout', 'light', 'harvesting', 'terminated', 'lost'
);

-- 1. Variety library
CREATE TABLE microgreen_crops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  name text NOT NULL,
  variety text,
  seed_density_g_per_tray numeric NOT NULL CHECK (seed_density_g_per_tray > 0),
  presoak_hours int NOT NULL DEFAULT 0 CHECK (presoak_hours >= 0),
  presprout_hours int NOT NULL DEFAULT 0 CHECK (presprout_hours >= 0),
  bury_seed boolean NOT NULL DEFAULT false,
  weight_during_blackout boolean NOT NULL DEFAULT false,
  blackout_days int NOT NULL DEFAULT 0 CHECK (blackout_days >= 0),
  keep_in_blackout boolean NOT NULL DEFAULT false,
  ideal_harvest_day int NOT NULL CHECK (ideal_harvest_day > 0),
  harvest_min_days int,
  harvest_max_days int,
  expected_yield_oz_per_tray numeric NOT NULL CHECK (expected_yield_oz_per_tray > 0),
  is_continuous_harvest boolean NOT NULL DEFAULT false,
  productive_life_days int,
  growing_medium text[] NOT NULL DEFAULT '{soil}',
  preferred_medium text,
  tray_size text NOT NULL DEFAULT '10x20',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blackout_within_harvest CHECK (blackout_days <= ideal_harvest_day),
  CONSTRAINT productive_life_only_when_continuous
    CHECK ((is_continuous_harvest = false) OR (productive_life_days IS NOT NULL AND productive_life_days > 0))
);

-- 2. Weekly demand targets
CREATE TABLE microgreen_demand (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id uuid NOT NULL REFERENCES microgreen_crops(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  target_oz numeric NOT NULL CHECK (target_oz > 0),
  effective_from date,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX microgreen_demand_unique
  ON microgreen_demand (crop_id, COALESCE(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid), day_of_week, COALESCE(effective_from, '0001-01-01'::date));

-- 3. Sow batches
CREATE TABLE microgreen_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id uuid NOT NULL REFERENCES microgreen_crops(id) ON DELETE RESTRICT,
  sow_date date NOT NULL,
  soak_started_at timestamptz,
  planned_blackout_end date,
  planned_harvest_date date NOT NULL,
  tray_count int NOT NULL CHECK (tray_count > 0),
  seed_lot text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Individual trays
CREATE TABLE microgreen_trays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES microgreen_batches(id) ON DELETE CASCADE,
  tray_label text NOT NULL,
  status microgreen_tray_status NOT NULL,
  sow_date date NOT NULL,
  blackout_start date,
  light_start date,
  harvesting_start timestamptz,
  terminated_at timestamptz,
  lost_reason text,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lost_reason_required CHECK (status <> 'lost' OR lost_reason IS NOT NULL)
);

-- 5. Harvest events
CREATE TABLE microgreen_harvests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tray_id uuid NOT NULL REFERENCES microgreen_trays(id) ON DELETE CASCADE,
  harvested_at timestamptz NOT NULL DEFAULT now(),
  yield_oz numeric NOT NULL CHECK (yield_oz >= 0),
  unit text NOT NULL DEFAULT 'oz',
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_microgreen_trays_status ON microgreen_trays (status, sow_date);
CREATE INDEX idx_microgreen_batches_sow_date ON microgreen_batches (sow_date);
CREATE INDEX idx_microgreen_batches_harvest ON microgreen_batches (planned_harvest_date);
CREATE INDEX idx_microgreen_harvests_harvested_at ON microgreen_harvests (harvested_at);
CREATE INDEX idx_microgreen_harvests_tray ON microgreen_harvests (tray_id);
CREATE INDEX idx_microgreen_demand_lookup ON microgreen_demand (crop_id, day_of_week);

-- RLS — admin-only, matching the plantings pattern
ALTER TABLE microgreen_crops    ENABLE ROW LEVEL SECURITY;
ALTER TABLE microgreen_demand   ENABLE ROW LEVEL SECURITY;
ALTER TABLE microgreen_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE microgreen_trays    ENABLE ROW LEVEL SECURITY;
ALTER TABLE microgreen_harvests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to microgreen_crops"
  ON microgreen_crops    FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to microgreen_demand"
  ON microgreen_demand   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to microgreen_batches"
  ON microgreen_batches  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to microgreen_trays"
  ON microgreen_trays    FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to microgreen_harvests"
  ON microgreen_harvests FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- updated_at triggers
CREATE TRIGGER update_microgreen_crops_updated_at
  BEFORE UPDATE ON microgreen_crops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_microgreen_demand_updated_at
  BEFORE UPDATE ON microgreen_demand
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_microgreen_trays_updated_at
  BEFORE UPDATE ON microgreen_trays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: Have Micheal run the migration**

Per CLAUDE.md, present this SQL to Micheal — he runs it in the Supabase web SQL editor at https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new. Wait for confirmation before proceeding to Task 3.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/045_microgreens_module.sql
git commit -m "feat: migration 045 - microgreens production module schema

Five new tables (microgreen_crops, microgreen_demand, microgreen_batches,
microgreen_trays, microgreen_harvests) plus microgreen_tray_status enum.
Admin-only RLS matching the plantings pattern. Indexes for dashboard +
calendar queries.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Seed data array + review CSV

**Files:**
- Create: `src/lib/microgreens/seedData.ts`
- Create: `scripts/microgreen-seed-review.ts`

- [ ] **Step 1: Create `src/lib/microgreens/seedData.ts`**

This module exports the ~70 microgreen crop rows extracted from the variety spreadsheet. Range values use midpoint; original strings preserved in `notes`. Flagged rows (suspected drag-fill / typos) get a `_review` flag.

```ts
// Pasted from Micheal's variety spreadsheet 2026-05-17.
// Ranges normalized to midpoint for planning. Original strings in notes.
// Rows flagged with _review: true need human sanity-check before live use.

export type SeedCrop = {
  name: string;
  variety?: string;
  seed_density_g_per_tray: number;
  presoak_hours: number;
  presprout_hours: number;
  bury_seed: boolean;
  weight_during_blackout: boolean;
  blackout_days: number;
  keep_in_blackout: boolean;
  ideal_harvest_day: number;
  harvest_min_days?: number;
  harvest_max_days?: number;
  expected_yield_oz_per_tray: number;
  is_continuous_harvest: boolean;
  productive_life_days?: number;
  growing_medium: string[];
  preferred_medium?: string;
  notes?: string;
  _review?: boolean;  // not persisted — used by review CSV script
};

// Default yield estimate when spreadsheet didn't provide one (oz per 10x20 tray).
const DEFAULT_YIELD_OZ = 8;

export const SEED_CROPS: SeedCrop[] = [
  {
    name: "Amaranth",
    seed_density_g_per_tray: 15,
    presoak_hours: 0,
    presprout_hours: 0,
    bury_seed: false,
    weight_during_blackout: false,
    blackout_days: 6,            // "5-6 D" → 6
    keep_in_blackout: false,
    ideal_harvest_day: 12,
    harvest_min_days: 12,
    harvest_max_days: 14,
    expected_yield_oz_per_tray: DEFAULT_YIELD_OZ,
    is_continuous_harvest: false,
    growing_medium: ["soil", "hydroponic"],
    preferred_medium: "soil",
    notes: 'Original: Blackout 5-6 D, Harvest 12-14 D, Ideal 12 D. "Can harvest as early as Day 14; waiting yields larger crop, some wait to Day 28."',
  },
  {
    name: "Arugula",
    seed_density_g_per_tray: 12,
    presoak_hours: 0, presprout_hours: 0,
    bury_seed: false, weight_during_blackout: true,
    blackout_days: 3,             // "2-3 D" weighted → 3
    keep_in_blackout: false,
    ideal_harvest_day: 9,         // "6-12 D" midpoint → 9
    harvest_min_days: 6, harvest_max_days: 12,
    expected_yield_oz_per_tray: DEFAULT_YIELD_OZ,
    is_continuous_harvest: false,
    growing_medium: ["soil"],
    preferred_medium: "soil",
    notes: "Original: Weight 2-D, Blackout 4-6 D (taken as germination), Harvest 6-12 D.",
  },
  {
    name: "Basil", variety: "Green / Opal / Thai",
    seed_density_g_per_tray: 4,
    presoak_hours: 0, presprout_hours: 0,
    bury_seed: false, weight_during_blackout: true,
    blackout_days: 6,             // "5-7 D" midpoint → 6
    keep_in_blackout: false,
    ideal_harvest_day: 22,        // "20-25 D" midpoint → 22
    harvest_min_days: 20, harvest_max_days: 25,
    expected_yield_oz_per_tray: DEFAULT_YIELD_OZ,
    is_continuous_harvest: false,
    growing_medium: ["soil"],
    notes: "Original: Weight 5 D, Blackout 4-7 D, Harvest 20-25 D.",
  },
  // NOTE: The single-Basil rows for Genovese / Lemon / Purple in the spreadsheet
  // ("4-4 D", "5-4 D", "6-4 D") look like drag-fill artifacts.
  // Flagging for human review — using same defaults as Basil above.
  {
    name: "Basil", variety: "Genovese",
    seed_density_g_per_tray: 4,
    presoak_hours: 0, presprout_hours: 0,
    bury_seed: false, weight_during_blackout: true,
    blackout_days: 6, keep_in_blackout: false,
    ideal_harvest_day: 24,
    expected_yield_oz_per_tray: DEFAULT_YIELD_OZ,
    is_continuous_harvest: false,
    growing_medium: ["soil"],
    notes: "REVIEW: spreadsheet had Weight '6 D' / Germination '4-4 D'. Likely drag-fill artifact — verify before live use. Original Harvest: 24 D.",
    _review: true,
  },
  // ... [Plan continues this pattern for all 70 crops. For brevity here, the
  // remaining ~66 rows follow the same structure, derived directly from the
  // pasted spreadsheet. The implementing engineer should produce one entry
  // per spreadsheet row using these conventions:
  //   - Range "X-Y D" → midpoint, rounded; min/max stored in harvest_min/max
  //   - "N" → 0 or false depending on column
  //   - "Y" → true
  //   - "Hydroponic, Soil" → ["soil","hydroponic"]; "Soil" → ["soil"]; etc.
  //   - "Full Grow" in Blackout column → keep_in_blackout=true (Corn, Popcorn)
  //   - Presoak format "6-12 hrs (Cold Water), Presprout: 12-24 hrs"
  //     → presoak_hours=9, presprout_hours=18 (midpoints)
  //   - Continuous-harvest flag for crops whose notes say "can be grown after
  //     first harvest" (Nasturtium, Wheatgrass, etc.) — set productive_life_days
  //     to a reasonable estimate (Nasturtium ~30, Wheatgrass ~14).
  //   - Suspected drag-fill / typo rows: set _review: true and add a note.
  // The remaining crops to add (in spreadsheet order):
  //   Basil Lemon, Basil Purple, Beet, Borage, Broccoli, Brussel Sprouts,
  //   Buckwheat, Cabbage, Cantaloupe, Carrot, Cauliflower, Celery, Chard,
  //   Chard Magenta/Red/Yellow, Chervil, Chia, Chive/Green Onion,
  //   Chrysanthemum, Cilantro, Clover, Collard Greens, Corn (keep_in_blackout),
  //   Cress, Dill, Endive, Fava Bean, Fennel, Fenugreek, Kale, Kohlrabi (x2),
  //   Large Leaf Sorrel, Leek, Lettuce, Marigold Gem, Mustard, Nasturtium
  //   (continuous), Onion, Orach, Oregano, Parsley, Pea Shoot (presoak +
  //   presprout), Popcorn (keep_in_blackout, bury_seed), Radish + variants,
  //   Red Choi, Red Komatsuna, Rutabaga, Sage, Salad Burnet, Salad Mix,
  //   Shiso + variants (Shiso "72-96 D" is likely hours — flag for review),
  //   Sorrel Red Veined, Sunflower (presoak), Turnip, Water Pepper,
  //   Wheatgrass (presoak + presprout, continuous second-cut). ]
];

export function reviewCandidates(): SeedCrop[] {
  return SEED_CROPS.filter((c) => c._review);
}
```

- [ ] **Step 2: Add the remaining ~66 entries to `SEED_CROPS`**

Following the conventions in the comment block above, complete the array. Use Micheal's pasted spreadsheet as source. The engineer doing this task should not skip any row — every variety should produce an entry. Mark `_review: true` on any row that looks suspect.

- [ ] **Step 3: Create `scripts/microgreen-seed-review.ts`**

```ts
import { writeFileSync } from "node:fs";
import { SEED_CROPS, reviewCandidates } from "../src/lib/microgreens/seedData";

const rows = reviewCandidates();
const header = "name,variety,blackout_days,ideal_harvest_day,notes\n";
const body = rows
  .map((r) => `"${r.name}","${r.variety ?? ""}",${r.blackout_days},${r.ideal_harvest_day},"${(r.notes ?? "").replace(/"/g, '""')}"`)
  .join("\n");

writeFileSync("tmp_microgreen_seed_review.csv", header + body);
console.log(`Wrote ${rows.length} rows needing review → tmp_microgreen_seed_review.csv`);
console.log(`Total seed crops: ${SEED_CROPS.length}`);
```

- [ ] **Step 4: Generate the review CSV**

```bash
npx tsx scripts/microgreen-seed-review.ts
```
Expected: writes `tmp_microgreen_seed_review.csv`. Present it to Micheal for sanity check before Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/lib/microgreens/seedData.ts scripts/microgreen-seed-review.ts
git commit -m "feat: microgreen variety seed data + review CSV script

~70 crops from the Press Farm variety spreadsheet, ranges normalized to
midpoints. Suspect rows flagged with _review for human sanity check.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Apply seed data via one-shot script

**Files:**
- Create: `scripts/microgreen-seed-apply.ts`

- [ ] **Step 1: Create the apply script**

```ts
// Inserts SEED_CROPS into microgreen_crops via the admin client.
// Run once after migration 045 has been applied.

import { createClient } from "@supabase/supabase-js";
import { SEED_CROPS } from "../src/lib/microgreens/seedData";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !serviceKey) throw new Error("Missing Supabase env vars");

const sb = createClient(url, serviceKey);

async function main() {
  const { data: farms, error: ferr } = await sb.from("farms").select("id").limit(1);
  if (ferr || !farms?.length) throw new Error("No farm found");
  const farmId = farms[0].id;

  const rows = SEED_CROPS.map(({ _review, ...c }) => ({ ...c, farm_id: farmId }));
  const { error } = await sb.from("microgreen_crops").insert(rows);
  if (error) {
    console.error("Insert failed:", error);
    process.exit(1);
  }
  console.log(`Inserted ${rows.length} microgreen crops.`);
}

main();
```

- [ ] **Step 2: Run after migration is live**

```bash
npx tsx scripts/microgreen-seed-apply.ts
```
Expected: "Inserted N microgreen crops." (where N matches the seed array length). Check Supabase dashboard `microgreen_crops` table to confirm.

- [ ] **Step 3: Commit**

```bash
git add scripts/microgreen-seed-apply.ts
git commit -m "feat: one-shot seed apply script for microgreen crops

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: TypeScript types

**Files:**
- Modify: `src/types/database.ts`
- Create: `src/lib/microgreens/types.ts`
- Create: `src/lib/microgreens/constants.ts`

- [ ] **Step 1: Add row types to `src/types/database.ts`**

Append to the file (match the existing manual-types pattern; `(supabase as any)` casts are acceptable per CLAUDE.md):

```ts
export type MicrogreenTrayStatus =
  | "soaking" | "blackout" | "light" | "harvesting" | "terminated" | "lost";

export interface MicrogreenCrop {
  id: string;
  farm_id: string;
  item_id: string | null;
  name: string;
  variety: string | null;
  seed_density_g_per_tray: number;
  presoak_hours: number;
  presprout_hours: number;
  bury_seed: boolean;
  weight_during_blackout: boolean;
  blackout_days: number;
  keep_in_blackout: boolean;
  ideal_harvest_day: number;
  harvest_min_days: number | null;
  harvest_max_days: number | null;
  expected_yield_oz_per_tray: number;
  is_continuous_harvest: boolean;
  productive_life_days: number | null;
  growing_medium: string[];
  preferred_medium: string | null;
  tray_size: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MicrogreenDemand {
  id: string;
  crop_id: string;
  restaurant_id: string | null;
  day_of_week: number; // 0-6, JS convention
  target_oz: number;
  effective_from: string | null;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MicrogreenBatch {
  id: string;
  crop_id: string;
  sow_date: string;
  soak_started_at: string | null;
  planned_blackout_end: string | null;
  planned_harvest_date: string;
  tray_count: number;
  seed_lot: string | null;
  notes: string | null;
  created_at: string;
}

export interface MicrogreenTray {
  id: string;
  batch_id: string;
  tray_label: string;
  status: MicrogreenTrayStatus;
  sow_date: string;
  blackout_start: string | null;
  light_start: string | null;
  harvesting_start: string | null;
  terminated_at: string | null;
  lost_reason: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MicrogreenHarvest {
  id: string;
  tray_id: string;
  harvested_at: string;
  yield_oz: number;
  unit: string;
  delivery_id: string | null;
  restaurant_id: string | null;
  notes: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Create `src/lib/microgreens/constants.ts`**

```ts
import type { MicrogreenTrayStatus } from "@/types/database";

export const TRAY_STATUSES: MicrogreenTrayStatus[] = [
  "soaking", "blackout", "light", "harvesting", "terminated", "lost",
];

export const TRAY_STATUS_LABELS: Record<MicrogreenTrayStatus, string> = {
  soaking: "Soaking",
  blackout: "Blackout",
  light: "Light",
  harvesting: "Harvesting",
  terminated: "Done",
  lost: "Lost",
};

export const TRAY_STATUS_COLORS: Record<MicrogreenTrayStatus, string> = {
  soaking: "badge-blue",
  blackout: "bg-farm-dark/15 text-farm-dark",
  light: "badge-gold",
  harvesting: "badge-green",
  terminated: "bg-farm-muted/15 text-farm-muted",
  lost: "badge-red",
};

export const FORECAST_LOOKBACK_WEEKS = 8;
export const FORECAST_WARNING_RATIO = 1.25; // forecast > manual * 1.25 → warn

export const PLAN_HORIZON_DAYS = 21;

export const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const GROWING_MEDIA = ["soil", "hydroponic"] as const;
export type GrowingMedium = (typeof GROWING_MEDIA)[number];
```

- [ ] **Step 3: Create `src/lib/microgreens/types.ts`** (enriched/derived shapes)

```ts
import type {
  MicrogreenCrop,
  MicrogreenBatch,
  MicrogreenTray,
  MicrogreenHarvest,
  MicrogreenDemand,
} from "@/types/database";

export type TrayWithBatch = MicrogreenTray & { batch?: MicrogreenBatch };
export type TrayWithCrop = MicrogreenTray & {
  batch?: MicrogreenBatch & { crop?: MicrogreenCrop };
};
export type HarvestWithTray = MicrogreenHarvest & { tray?: TrayWithCrop };
export type DemandWithRestaurant = MicrogreenDemand & {
  restaurant?: { id: string; name: string } | null;
};

export type SowTask = {
  crop: MicrogreenCrop;
  delivery_date: string;     // ISO date
  sow_date: string;          // ISO date (== today for "today" tasks)
  trays_to_sow: number;
  trays_in_flight: number;
  trays_needed: number;
  expected_oz: number;
  manual_oz: number;
  forecast_oz: number;
  is_warning: boolean;       // forecast > manual * ratio
};

export type AdvanceTask = {
  tray: MicrogreenTray;
  crop: MicrogreenCrop;
  from_status: "soaking" | "blackout";
  to_status: "blackout" | "light";
};

export type HarvestTask = {
  tray: MicrogreenTray;
  crop: MicrogreenCrop;
  kind: "single-cut" | "continuous-ongoing";
  days_since_sow: number;
};

export type SowPlan = {
  sow_today: SowTask[];
  advance_today: AdvanceTask[];
  harvest_today: HarvestTask[];
  overdue: {
    sow: SowTask[];
    advance: AdvanceTask[];
    harvest: HarvestTask[];
  };
  warnings: SowTask[]; // forecast > manual * 1.25
};
```

- [ ] **Step 4: Commit**

```bash
git add src/types/database.ts src/lib/microgreens/types.ts src/lib/microgreens/constants.ts
git commit -m "feat: microgreens TS types + constants

Adds MicrogreenCrop / Demand / Batch / Tray / Harvest row types matching
migration 045. Enriched join shapes and SowPlan output type in
src/lib/microgreens/types.ts. Constants for status labels, colors, plan
horizon, forecast lookback.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: stages.ts — pure stage transition logic (TDD)

**Files:**
- Create: `tests/lib/microgreens/stages.test.ts`
- Create: `src/lib/microgreens/stages.ts`

- [ ] **Step 1: Write the failing tests**

`tests/lib/microgreens/stages.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  initialStatusForCrop,
  nextStatus,
  isReadyToAdvance,
  isReadyToHarvest,
} from "@/lib/microgreens/stages";
import type { MicrogreenCrop, MicrogreenTray } from "@/types/database";

const baseCrop: MicrogreenCrop = {
  id: "c1", farm_id: "f1", item_id: null,
  name: "Broccoli", variety: null,
  seed_density_g_per_tray: 22,
  presoak_hours: 0, presprout_hours: 0,
  bury_seed: false, weight_during_blackout: false,
  blackout_days: 3, keep_in_blackout: false,
  ideal_harvest_day: 10, harvest_min_days: 8, harvest_max_days: 12,
  expected_yield_oz_per_tray: 8,
  is_continuous_harvest: false, productive_life_days: null,
  growing_medium: ["soil"], preferred_medium: "soil",
  tray_size: "10x20", notes: null, is_active: true,
  created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
};

const baseTray = (overrides: Partial<MicrogreenTray>): MicrogreenTray => ({
  id: "t1", batch_id: "b1", tray_label: "BR-0517-01",
  status: "blackout", sow_date: "2026-05-17",
  blackout_start: "2026-05-17", light_start: null,
  harvesting_start: null, terminated_at: null,
  lost_reason: null, location: null, notes: null,
  created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
  ...overrides,
});

describe("initialStatusForCrop", () => {
  it("starts in soaking when presoak > 0", () => {
    expect(initialStatusForCrop({ ...baseCrop, presoak_hours: 6 })).toBe("soaking");
  });

  it("starts in soaking when presprout > 0", () => {
    expect(initialStatusForCrop({ ...baseCrop, presprout_hours: 12 })).toBe("soaking");
  });

  it("starts in blackout when no soak phase", () => {
    expect(initialStatusForCrop(baseCrop)).toBe("blackout");
  });
});

describe("nextStatus", () => {
  it("soaking -> blackout", () => {
    expect(nextStatus(baseCrop, "soaking")).toBe("blackout");
  });

  it("blackout -> light for normal crops", () => {
    expect(nextStatus(baseCrop, "blackout")).toBe("light");
  });

  it("blackout -> harvesting for keep_in_blackout crops", () => {
    expect(nextStatus({ ...baseCrop, keep_in_blackout: true }, "blackout")).toBe("harvesting");
  });

  it("light -> harvesting", () => {
    expect(nextStatus(baseCrop, "light")).toBe("harvesting");
  });

  it("harvesting -> terminated", () => {
    expect(nextStatus(baseCrop, "harvesting")).toBe("terminated");
  });
});

describe("isReadyToAdvance", () => {
  it("ready to advance from soaking when presoak+presprout hours have elapsed", () => {
    const crop = { ...baseCrop, presoak_hours: 6, presprout_hours: 12 };
    const tray = baseTray({
      status: "soaking",
      created_at: "2026-05-16T00:00:00Z", // 24h ago
    });
    expect(isReadyToAdvance(tray, crop, new Date("2026-05-17T00:00:00Z"))).toBe(true);
  });

  it("not ready from soaking when too soon", () => {
    const crop = { ...baseCrop, presoak_hours: 24, presprout_hours: 0 };
    const tray = baseTray({
      status: "soaking",
      created_at: "2026-05-17T00:00:00Z", // just now
    });
    expect(isReadyToAdvance(tray, crop, new Date("2026-05-17T06:00:00Z"))).toBe(false);
  });

  it("ready to advance from blackout when blackout_days have passed since sow_date", () => {
    const tray = baseTray({
      status: "blackout",
      sow_date: "2026-05-14",  // 3 days ago
      blackout_start: "2026-05-14",
    });
    expect(isReadyToAdvance(tray, baseCrop, new Date("2026-05-17T08:00:00Z"))).toBe(true);
  });

  it("not ready from blackout when too soon", () => {
    const tray = baseTray({
      status: "blackout",
      sow_date: "2026-05-16",  // 1 day ago
      blackout_start: "2026-05-16",
    });
    expect(isReadyToAdvance(tray, baseCrop, new Date("2026-05-17T08:00:00Z"))).toBe(false);
  });

  it("never ready to advance from light (light -> harvesting is a harvest event)", () => {
    const tray = baseTray({ status: "light" });
    expect(isReadyToAdvance(tray, baseCrop, new Date())).toBe(false);
  });
});

describe("isReadyToHarvest", () => {
  it("ready to harvest single-cut crop when sow_date + ideal_harvest_day == today", () => {
    const tray = baseTray({ sow_date: "2026-05-07", status: "light" });
    expect(isReadyToHarvest(tray, baseCrop, new Date("2026-05-17T08:00:00Z"))).toBe(true);
  });

  it("not ready when today is before ideal harvest day", () => {
    const tray = baseTray({ sow_date: "2026-05-15", status: "light" });
    expect(isReadyToHarvest(tray, baseCrop, new Date("2026-05-17T08:00:00Z"))).toBe(false);
  });

  it("continuous-harvest crop is ready whenever status is harvesting", () => {
    const crop = { ...baseCrop, is_continuous_harvest: true, productive_life_days: 30 };
    const tray = baseTray({ status: "harvesting" });
    expect(isReadyToHarvest(tray, crop, new Date("2026-05-17T08:00:00Z"))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- stages
```
Expected: all tests fail with "module not found".

- [ ] **Step 3: Implement `src/lib/microgreens/stages.ts`**

```ts
import type {
  MicrogreenCrop,
  MicrogreenTray,
  MicrogreenTrayStatus,
} from "@/types/database";

export function initialStatusForCrop(crop: MicrogreenCrop): MicrogreenTrayStatus {
  if (crop.presoak_hours > 0 || crop.presprout_hours > 0) return "soaking";
  return "blackout";
}

export function nextStatus(
  crop: MicrogreenCrop,
  current: MicrogreenTrayStatus,
): MicrogreenTrayStatus | null {
  switch (current) {
    case "soaking":   return "blackout";
    case "blackout":  return crop.keep_in_blackout ? "harvesting" : "light";
    case "light":     return "harvesting";
    case "harvesting":return "terminated";
    default:          return null;
  }
}

const MS_PER_HOUR = 3600 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function daysBetween(fromIso: string, to: Date): number {
  const from = new Date(fromIso + "T00:00:00Z").getTime();
  const today = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((today - from) / MS_PER_DAY);
}

export function isReadyToAdvance(
  tray: MicrogreenTray,
  crop: MicrogreenCrop,
  now: Date,
): boolean {
  if (tray.status === "soaking") {
    const startedAt = new Date(tray.created_at).getTime();
    const requiredHours = crop.presoak_hours + crop.presprout_hours;
    return (now.getTime() - startedAt) / MS_PER_HOUR >= requiredHours;
  }
  if (tray.status === "blackout") {
    const elapsed = daysBetween(tray.blackout_start ?? tray.sow_date, now);
    return elapsed >= crop.blackout_days;
  }
  // 'light' -> 'harvesting' goes through harvest event, not advance.
  return false;
}

export function isReadyToHarvest(
  tray: MicrogreenTray,
  crop: MicrogreenCrop,
  now: Date,
): boolean {
  if (crop.is_continuous_harvest && tray.status === "harvesting") return true;

  if (tray.status === "light" || (crop.keep_in_blackout && tray.status === "blackout")) {
    const elapsed = daysBetween(tray.sow_date, now);
    return elapsed >= crop.ideal_harvest_day;
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- stages
```
Expected: all stages tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/lib/microgreens/stages.test.ts src/lib/microgreens/stages.ts
git commit -m "feat: microgreens stage transition logic (TDD)

Pure functions: initialStatusForCrop, nextStatus, isReadyToAdvance,
isReadyToHarvest. Handles soak/presprout windows, blackout duration,
keep_in_blackout (corn/popcorn), continuous-harvest crops.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: trayLabel.ts — auto-generated tray labels (TDD)

**Files:**
- Create: `tests/lib/microgreens/trayLabel.test.ts`
- Create: `src/lib/microgreens/trayLabel.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { buildTrayLabel, cropInitials } from "@/lib/microgreens/trayLabel";

describe("cropInitials", () => {
  it("uses first 2 letters of single-word name", () => {
    expect(cropInitials("Broccoli")).toBe("BR");
  });

  it("uses first letters of two words", () => {
    expect(cropInitials("Pea Shoot")).toBe("PS");
  });

  it("uses first 2 letters from first 2 words of >2-word name", () => {
    expect(cropInitials("Large Leaf Sorrel")).toBe("LL");
  });

  it("uppercases", () => {
    expect(cropInitials("amaranth")).toBe("AM");
  });
});

describe("buildTrayLabel", () => {
  it("formats as INITIALS-MMDD-SEQ", () => {
    expect(buildTrayLabel("Broccoli", new Date("2026-05-17"), 1)).toBe("BR-0517-01");
  });

  it("zero-pads sequence to 2 digits", () => {
    expect(buildTrayLabel("Broccoli", new Date("2026-05-17"), 12)).toBe("BR-0517-12");
  });

  it("zero-pads month and day", () => {
    expect(buildTrayLabel("Pea Shoot", new Date("2026-01-03"), 5)).toBe("PS-0103-05");
  });
});
```

- [ ] **Step 2: Run test, confirm fail**

```bash
npm test -- trayLabel
```

- [ ] **Step 3: Implement**

```ts
// src/lib/microgreens/trayLabel.ts

export function cropInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function buildTrayLabel(cropName: string, sowDate: Date, sequence: number): string {
  const mm = pad2(sowDate.getUTCMonth() + 1);
  const dd = pad2(sowDate.getUTCDate());
  return `${cropInitials(cropName)}-${mm}${dd}-${pad2(sequence)}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- trayLabel
```

- [ ] **Step 5: Commit**

```bash
git add tests/lib/microgreens/trayLabel.test.ts src/lib/microgreens/trayLabel.ts
git commit -m "feat: tray label generator (BR-0517-01 format)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: forecast.ts — rolling 8-week demand from history (TDD)

**Files:**
- Create: `tests/lib/microgreens/forecast.test.ts`
- Create: `src/lib/microgreens/forecast.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { computeForecast } from "@/lib/microgreens/forecast";

type Row = { delivery_date: string; quantity_oz: number; item_id: string };

describe("computeForecast", () => {
  it("returns 0 for crops with no item_id", () => {
    const result = computeForecast([], null, 4 /* Thursday */, new Date("2026-05-17"));
    expect(result).toBe(0);
  });

  it("averages oz across deliveries on the same day-of-week", () => {
    // 4 Thursdays of deliveries: 8, 10, 12, 6 -> avg 9
    const rows: Row[] = [
      { delivery_date: "2026-05-14", quantity_oz: 8,  item_id: "i1" }, // Thu
      { delivery_date: "2026-05-07", quantity_oz: 10, item_id: "i1" },
      { delivery_date: "2026-04-30", quantity_oz: 12, item_id: "i1" },
      { delivery_date: "2026-04-23", quantity_oz: 6,  item_id: "i1" },
    ];
    expect(computeForecast(rows, "i1", 4, new Date("2026-05-17"))).toBe(9);
  });

  it("ignores deliveries for other items", () => {
    const rows: Row[] = [
      { delivery_date: "2026-05-14", quantity_oz: 8,  item_id: "i1" },
      { delivery_date: "2026-05-14", quantity_oz: 99, item_id: "i2" },
    ];
    expect(computeForecast(rows, "i1", 4, new Date("2026-05-17"))).toBe(8);
  });

  it("ignores deliveries outside the lookback window", () => {
    const rows: Row[] = [
      { delivery_date: "2026-05-14", quantity_oz: 8, item_id: "i1" }, // in window
      { delivery_date: "2026-01-01", quantity_oz: 99, item_id: "i1" }, // out
    ];
    expect(computeForecast(rows, "i1", 4, new Date("2026-05-17"))).toBe(8);
  });

  it("ignores deliveries on different day-of-week", () => {
    const rows: Row[] = [
      { delivery_date: "2026-05-14", quantity_oz: 8,  item_id: "i1" }, // Thu
      { delivery_date: "2026-05-16", quantity_oz: 99, item_id: "i1" }, // Sat
    ];
    expect(computeForecast(rows, "i1", 4, new Date("2026-05-17"))).toBe(8);
  });

  it("returns 0 when no matching deliveries", () => {
    expect(computeForecast([], "i1", 4, new Date("2026-05-17"))).toBe(0);
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- forecast
```

- [ ] **Step 3: Implement**

```ts
// src/lib/microgreens/forecast.ts
import { FORECAST_LOOKBACK_WEEKS } from "./constants";

type DeliveryItemRow = {
  delivery_date: string;
  quantity_oz: number;
  item_id: string;
};

const MS_PER_DAY = 24 * 3600 * 1000;

export function computeForecast(
  rows: DeliveryItemRow[],
  itemId: string | null,
  dayOfWeek: number,
  now: Date,
): number {
  if (!itemId) return 0;

  const cutoff = now.getTime() - FORECAST_LOOKBACK_WEEKS * 7 * MS_PER_DAY;
  const matches = rows.filter((r) => {
    if (r.item_id !== itemId) return false;
    const d = new Date(r.delivery_date + "T00:00:00Z");
    if (d.getUTCDay() !== dayOfWeek) return false;
    return d.getTime() >= cutoff && d.getTime() <= now.getTime();
  });

  if (matches.length === 0) return 0;
  const total = matches.reduce((sum, r) => sum + (r.quantity_oz ?? 0), 0);
  return total / matches.length;
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- forecast
```

- [ ] **Step 5: Commit**

```bash
git add tests/lib/microgreens/forecast.test.ts src/lib/microgreens/forecast.ts
git commit -m "feat: rolling 8-week demand forecast (TDD)

Pure function: averages historical delivery_items quantity_oz by item_id
and day_of_week within an 8-week lookback window.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: sowPlan.ts — the core backward-schedule algorithm (TDD)

**Files:**
- Create: `tests/lib/microgreens/sowPlan.test.ts`
- Create: `src/lib/microgreens/sowPlan.ts`

This is the highest-risk module. Full TDD coverage.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { computeSowPlan } from "@/lib/microgreens/sowPlan";
import type {
  MicrogreenCrop, MicrogreenDemand, MicrogreenBatch, MicrogreenTray,
} from "@/types/database";

const broccoli: MicrogreenCrop = {
  id: "crop-broccoli", farm_id: "f1", item_id: "item-broccoli",
  name: "Broccoli", variety: null,
  seed_density_g_per_tray: 22,
  presoak_hours: 0, presprout_hours: 0,
  bury_seed: false, weight_during_blackout: false,
  blackout_days: 3, keep_in_blackout: false,
  ideal_harvest_day: 10, harvest_min_days: 8, harvest_max_days: 12,
  expected_yield_oz_per_tray: 8,
  is_continuous_harvest: false, productive_life_days: null,
  growing_medium: ["soil"], preferred_medium: "soil",
  tray_size: "10x20", notes: null, is_active: true,
  created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
};

const sat2026_05_30 = "2026-05-30"; // Saturday, +13 days
const today = new Date("2026-05-17T00:00:00Z"); // a Sunday

describe("computeSowPlan", () => {
  it("returns empty buckets when no demand", () => {
    const plan = computeSowPlan({
      crops: [broccoli],
      demand: [],
      batches: [],
      trays: [],
      deliveryDates: [sat2026_05_30],
      historicalDeliveryItems: [],
      now: today,
    });
    expect(plan.sow_today).toEqual([]);
    expect(plan.harvest_today).toEqual([]);
  });

  it("schedules a sow today when delivery_date - ideal_harvest_day == today", () => {
    // sat2026_05_30 is 13 days out; ideal_harvest_day = 10 -> sow on 2026-05-20.
    // For sow_today == today we need delivery 10 days out -> 2026-05-27 (Wed).
    // But the system only schedules for actual delivery_dates list.
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: "rest-press",
      day_of_week: 3, // Wednesday
      target_oz: 16,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
    const plan = computeSowPlan({
      crops: [broccoli],
      demand,
      batches: [],
      trays: [],
      deliveryDates: [delivery],
      historicalDeliveryItems: [],
      now: today,
    });
    expect(plan.sow_today).toHaveLength(1);
    expect(plan.sow_today[0].trays_to_sow).toBe(2); // ceil(16 / 8)
    expect(plan.sow_today[0].delivery_date).toBe(delivery);
  });

  it("subtracts in-flight trays from trays_to_sow", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: null,
      day_of_week: 3, target_oz: 16,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
    const batch: MicrogreenBatch = {
      id: "b1", crop_id: broccoli.id, sow_date: "2026-05-17",
      soak_started_at: null, planned_blackout_end: "2026-05-20",
      planned_harvest_date: delivery, tray_count: 1,
      seed_lot: null, notes: null,
      created_at: "2026-05-17T00:00:00Z",
    };
    const tray: MicrogreenTray = {
      id: "t1", batch_id: "b1", tray_label: "BR-0517-01",
      status: "blackout", sow_date: "2026-05-17",
      blackout_start: "2026-05-17", light_start: null,
      harvesting_start: null, terminated_at: null,
      lost_reason: null, location: null, notes: null,
      created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
    };
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [batch], trays: [tray],
      deliveryDates: [delivery], historicalDeliveryItems: [],
      now: today,
    });
    expect(plan.sow_today[0].trays_to_sow).toBe(1); // needed 2 - inflight 1
    expect(plan.sow_today[0].trays_in_flight).toBe(1);
  });

  it("excludes terminated/lost trays from in-flight count", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: null,
      day_of_week: 3, target_oz: 16,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
    const batch: MicrogreenBatch = {
      id: "b1", crop_id: broccoli.id, sow_date: "2026-05-17",
      soak_started_at: null, planned_blackout_end: "2026-05-20",
      planned_harvest_date: delivery, tray_count: 2,
      seed_lot: null, notes: null,
      created_at: "2026-05-17T00:00:00Z",
    };
    const trays: MicrogreenTray[] = [
      {
        id: "t1", batch_id: "b1", tray_label: "BR-0517-01",
        status: "lost", sow_date: "2026-05-17",
        blackout_start: "2026-05-17", light_start: null,
        harvesting_start: null, terminated_at: null,
        lost_reason: "mold", location: null, notes: null,
        created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
      },
      {
        id: "t2", batch_id: "b1", tray_label: "BR-0517-02",
        status: "blackout", sow_date: "2026-05-17",
        blackout_start: "2026-05-17", light_start: null,
        harvesting_start: null, terminated_at: null,
        lost_reason: null, location: null, notes: null,
        created_at: "2026-05-17T00:00:00Z", updated_at: "2026-05-17T00:00:00Z",
      },
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [batch], trays, deliveryDates: [delivery],
      historicalDeliveryItems: [], now: today,
    });
    expect(plan.sow_today[0].trays_in_flight).toBe(1); // only t2 counts
    expect(plan.sow_today[0].trays_to_sow).toBe(1);    // 2 needed - 1 in flight
  });

  it("aggregates demand across restaurants for same day-of-week", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [
      {
        id: "d1", crop_id: broccoli.id, restaurant_id: "rest-press",
        day_of_week: 3, target_oz: 8,
        effective_from: null, effective_to: null, notes: null,
        created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
      },
      {
        id: "d2", crop_id: broccoli.id, restaurant_id: "rest-under",
        day_of_week: 3, target_oz: 8,
        effective_from: null, effective_to: null, notes: null,
        created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
      },
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery], historicalDeliveryItems: [],
      now: today,
    });
    expect(plan.sow_today[0].expected_oz).toBe(16);
    expect(plan.sow_today[0].trays_to_sow).toBe(2);
  });

  it("flags a warning when forecast exceeds manual by 25%", () => {
    const delivery = "2026-05-27";
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: null,
      day_of_week: 3, target_oz: 8,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
    const history = [
      { delivery_date: "2026-05-13", quantity_oz: 12, item_id: "item-broccoli" },
      { delivery_date: "2026-05-06", quantity_oz: 12, item_id: "item-broccoli" },
      { delivery_date: "2026-04-29", quantity_oz: 12, item_id: "item-broccoli" },
      { delivery_date: "2026-04-22", quantity_oz: 12, item_id: "item-broccoli" },
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery],
      historicalDeliveryItems: history,
      now: today,
    });
    const task = plan.sow_today[0];
    expect(task.manual_oz).toBe(8);
    expect(task.forecast_oz).toBe(12);
    expect(task.is_warning).toBe(true);
    expect(plan.warnings).toHaveLength(1);
  });

  it("uses forecast as fallback when no manual demand is set", () => {
    const delivery = "2026-05-27";
    const history = [
      { delivery_date: "2026-05-13", quantity_oz: 16, item_id: "item-broccoli" },
      { delivery_date: "2026-05-06", quantity_oz: 16, item_id: "item-broccoli" },
    ];
    const plan = computeSowPlan({
      crops: [broccoli], demand: [], batches: [], trays: [],
      deliveryDates: [delivery],
      historicalDeliveryItems: history,
      now: today,
    });
    expect(plan.sow_today).toHaveLength(1);
    expect(plan.sow_today[0].expected_oz).toBe(16);
    expect(plan.sow_today[0].is_warning).toBe(false); // no manual to compare against
  });

  it("places past-due sow tasks in overdue.sow", () => {
    const delivery = "2026-05-22"; // 5 days out -> sow_date 2026-05-12 (5 days ago)
    const demand: MicrogreenDemand[] = [{
      id: "d1", crop_id: broccoli.id, restaurant_id: null,
      day_of_week: new Date(delivery + "T00:00:00Z").getUTCDay(),
      target_oz: 8,
      effective_from: null, effective_to: null, notes: null,
      created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z",
    }];
    const plan = computeSowPlan({
      crops: [broccoli], demand, batches: [], trays: [],
      deliveryDates: [delivery],
      historicalDeliveryItems: [], now: today,
    });
    expect(plan.sow_today).toHaveLength(0);
    expect(plan.overdue.sow).toHaveLength(1);
  });

  it("populates advance_today when blackout completes today", () => {
    const tray: MicrogreenTray = {
      id: "t1", batch_id: "b1", tray_label: "BR-0514-01",
      status: "blackout", sow_date: "2026-05-14",   // 3 days ago
      blackout_start: "2026-05-14", light_start: null,
      harvesting_start: null, terminated_at: null,
      lost_reason: null, location: null, notes: null,
      created_at: "2026-05-14T00:00:00Z", updated_at: "2026-05-14T00:00:00Z",
    };
    const batch: MicrogreenBatch = {
      id: "b1", crop_id: broccoli.id, sow_date: "2026-05-14",
      soak_started_at: null, planned_blackout_end: "2026-05-17",
      planned_harvest_date: "2026-05-24", tray_count: 1,
      seed_lot: null, notes: null,
      created_at: "2026-05-14T00:00:00Z",
    };
    const plan = computeSowPlan({
      crops: [broccoli], demand: [], batches: [batch], trays: [tray],
      deliveryDates: [], historicalDeliveryItems: [], now: today,
    });
    expect(plan.advance_today).toHaveLength(1);
    expect(plan.advance_today[0].from_status).toBe("blackout");
    expect(plan.advance_today[0].to_status).toBe("light");
  });

  it("populates harvest_today for single-cut tray at ideal_harvest_day", () => {
    const tray: MicrogreenTray = {
      id: "t1", batch_id: "b1", tray_label: "BR-0507-01",
      status: "light",
      sow_date: "2026-05-07", // 10 days ago, ideal_harvest_day = 10
      blackout_start: "2026-05-07", light_start: "2026-05-10",
      harvesting_start: null, terminated_at: null,
      lost_reason: null, location: null, notes: null,
      created_at: "2026-05-07T00:00:00Z", updated_at: "2026-05-07T00:00:00Z",
    };
    const batch: MicrogreenBatch = {
      id: "b1", crop_id: broccoli.id, sow_date: "2026-05-07",
      soak_started_at: null, planned_blackout_end: "2026-05-10",
      planned_harvest_date: "2026-05-17", tray_count: 1,
      seed_lot: null, notes: null,
      created_at: "2026-05-07T00:00:00Z",
    };
    const plan = computeSowPlan({
      crops: [broccoli], demand: [], batches: [batch], trays: [tray],
      deliveryDates: [], historicalDeliveryItems: [], now: today,
    });
    expect(plan.harvest_today).toHaveLength(1);
    expect(plan.harvest_today[0].kind).toBe("single-cut");
  });
});
```

- [ ] **Step 2: Run, confirm fail**

```bash
npm test -- sowPlan
```

- [ ] **Step 3: Implement `src/lib/microgreens/sowPlan.ts`**

```ts
import type {
  MicrogreenCrop, MicrogreenDemand, MicrogreenBatch, MicrogreenTray,
} from "@/types/database";
import type { SowPlan, SowTask, AdvanceTask, HarvestTask } from "./types";
import { isReadyToAdvance, isReadyToHarvest, nextStatus } from "./stages";
import { computeForecast } from "./forecast";
import { FORECAST_WARNING_RATIO, PLAN_HORIZON_DAYS } from "./constants";

type DeliveryItemRow = {
  delivery_date: string;
  quantity_oz: number;
  item_id: string;
};

export type SowPlanInput = {
  crops: MicrogreenCrop[];
  demand: MicrogreenDemand[];
  batches: MicrogreenBatch[];
  trays: MicrogreenTray[];
  deliveryDates: string[]; // future ISO dates within horizon
  historicalDeliveryItems: DeliveryItemRow[];
  now: Date;
};

const MS_PER_DAY = 24 * 3600 * 1000;

function isoDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function pad(n: number) { return n.toString().padStart(2, "0"); }

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return isoDateUtc(d);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

function effectiveDemandFor(
  crop: MicrogreenCrop,
  deliveryDate: string,
  demand: MicrogreenDemand[],
  historicalDeliveryItems: DeliveryItemRow[],
  now: Date,
): { manual_oz: number; forecast_oz: number; expected_oz: number; is_warning: boolean } {
  const dow = new Date(deliveryDate + "T00:00:00Z").getUTCDay();
  const matching = demand.filter((d) => {
    if (d.crop_id !== crop.id) return false;
    if (d.day_of_week !== dow) return false;
    if (d.effective_from && deliveryDate < d.effective_from) return false;
    if (d.effective_to && deliveryDate > d.effective_to) return false;
    return true;
  });
  const manual_oz = matching.reduce((sum, d) => sum + Number(d.target_oz), 0);
  const forecast_oz = computeForecast(historicalDeliveryItems, crop.item_id, dow, now);

  const expected_oz = manual_oz > 0 ? manual_oz : forecast_oz;
  const is_warning =
    manual_oz > 0 && forecast_oz > manual_oz * FORECAST_WARNING_RATIO;

  return { manual_oz, forecast_oz, expected_oz, is_warning };
}

function traysInFlightFor(
  crop: MicrogreenCrop,
  deliveryDate: string,
  batches: MicrogreenBatch[],
  trays: MicrogreenTray[],
): number {
  const relevantBatchIds = new Set(
    batches.filter((b) => b.crop_id === crop.id && b.planned_harvest_date === deliveryDate).map((b) => b.id),
  );
  return trays.filter(
    (t) => relevantBatchIds.has(t.batch_id) && t.status !== "terminated" && t.status !== "lost",
  ).length;
}

export function computeSowPlan(input: SowPlanInput): SowPlan {
  const { crops, demand, batches, trays, deliveryDates, historicalDeliveryItems, now } = input;
  const todayIso = isoDateUtc(now);

  const sow_today: SowTask[] = [];
  const overdueSow: SowTask[] = [];
  const warnings: SowTask[] = [];

  for (const crop of crops) {
    if (!crop.is_active) continue;
    for (const delivery_date of deliveryDates) {
      const daysOut = daysBetween(todayIso, delivery_date);
      if (daysOut < 0 || daysOut > PLAN_HORIZON_DAYS) continue;

      const { manual_oz, forecast_oz, expected_oz, is_warning } = effectiveDemandFor(
        crop, delivery_date, demand, historicalDeliveryItems, now,
      );
      if (expected_oz <= 0) continue;

      const sow_date = addDays(delivery_date, -crop.ideal_harvest_day);
      const trays_needed = Math.ceil(expected_oz / crop.expected_yield_oz_per_tray);
      const trays_in_flight = traysInFlightFor(crop, delivery_date, batches, trays);
      const trays_to_sow = Math.max(0, trays_needed - trays_in_flight);

      if (trays_to_sow <= 0) continue;

      const task: SowTask = {
        crop, delivery_date, sow_date,
        trays_to_sow, trays_in_flight, trays_needed,
        expected_oz, manual_oz, forecast_oz, is_warning,
      };
      if (sow_date === todayIso) sow_today.push(task);
      else if (sow_date < todayIso) overdueSow.push(task);
      if (is_warning) warnings.push(task);
    }
  }

  // Advance tasks
  const cropById = new Map(crops.map((c) => [c.id, c]));
  const batchById = new Map(batches.map((b) => [b.id, b]));

  const advance_today: AdvanceTask[] = [];
  const overdueAdvance: AdvanceTask[] = [];
  const harvest_today: HarvestTask[] = [];
  const overdueHarvest: HarvestTask[] = [];

  for (const tray of trays) {
    const batch = batchById.get(tray.batch_id);
    if (!batch) continue;
    const crop = cropById.get(batch.crop_id);
    if (!crop) continue;

    if (isReadyToAdvance(tray, crop, now)) {
      const to = nextStatus(crop, tray.status);
      if (to === "blackout" || to === "light") {
        advance_today.push({
          tray, crop,
          from_status: tray.status as "soaking" | "blackout",
          to_status: to,
        });
      }
    } else if (
      (tray.status === "soaking" || tray.status === "blackout") &&
      isOverdueAdvance(tray, crop, now)
    ) {
      const to = nextStatus(crop, tray.status);
      if (to === "blackout" || to === "light") {
        overdueAdvance.push({
          tray, crop,
          from_status: tray.status as "soaking" | "blackout",
          to_status: to,
        });
      }
    }

    if (isReadyToHarvest(tray, crop, now)) {
      const days_since_sow = daysBetween(tray.sow_date, todayIso);
      const kind: HarvestTask["kind"] =
        crop.is_continuous_harvest && tray.status === "harvesting"
          ? "continuous-ongoing"
          : "single-cut";
      harvest_today.push({ tray, crop, kind, days_since_sow });
    }
  }

  return {
    sow_today,
    advance_today,
    harvest_today,
    overdue: { sow: overdueSow, advance: overdueAdvance, harvest: overdueHarvest },
    warnings,
  };
}

// Helper: check if a tray's advance is overdue (passed the required time).
function isOverdueAdvance(
  tray: MicrogreenTray,
  crop: MicrogreenCrop,
  now: Date,
): boolean {
  if (tray.status === "soaking") {
    const startedAt = new Date(tray.created_at).getTime();
    const requiredMs = (crop.presoak_hours + crop.presprout_hours) * 3600 * 1000;
    return now.getTime() - startedAt > requiredMs;
  }
  if (tray.status === "blackout") {
    const blackoutStart = tray.blackout_start ?? tray.sow_date;
    const todayIso = isoDateUtc(now);
    return daysBetween(blackoutStart, todayIso) > crop.blackout_days;
  }
  return false;
}
```

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- sowPlan
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/lib/microgreens/sowPlan.test.ts src/lib/microgreens/sowPlan.ts
git commit -m "feat: sow plan algorithm (TDD)

Pure computeSowPlan(input) -> SowPlan output: today's sow/advance/harvest
tasks plus overdue buckets and forecast warnings. Aggregates demand across
restaurants per day-of-week, backward-schedules from delivery dates,
subtracts in-flight trays.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: API — Crops CRUD

**Files:**
- Create: `src/app/api/microgreens/crops/route.ts`
- Create: `src/app/api/microgreens/crops/[id]/route.ts`
- Create: `tests/api/microgreens/crops.test.ts`

- [ ] **Step 1: Write failing tests**

`tests/api/microgreens/crops.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { GET, POST } = await import("@/app/api/microgreens/crops/route");

describe("GET /api/microgreens/crops", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns active crops sorted by name", async () => {
    const sb = makeSupabaseMock({
      microgreen_crops: [
        { id: "c1", name: "Broccoli", is_active: true },
        { id: "c2", name: "Arugula", is_active: true },
        { id: "c3", name: "Old", is_active: false },
      ],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/crops");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.crops).toHaveLength(2); // archived excluded
  });
});

describe("POST /api/microgreens/crops", () => {
  it("creates a crop with farm_id auto-filled", async () => {
    const sb = makeSupabaseMock({
      farms: [{ id: "farm-1" }],
      microgreen_crops: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/crops", {
      method: "POST",
      body: JSON.stringify({
        name: "Broccoli", seed_density_g_per_tray: 22, blackout_days: 3,
        ideal_harvest_day: 10, expected_yield_oz_per_tray: 8,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_crops).toHaveLength(1);
    expect(sb._data.microgreen_crops[0].farm_id).toBe("farm-1");
  });

  it("returns 400 for missing required fields", async () => {
    const sb = makeSupabaseMock({ farms: [{ id: "farm-1" }] });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/crops", {
      method: "POST",
      body: JSON.stringify({ name: "Broccoli" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Implement `src/app/api/microgreens/crops/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const REQUIRED = [
  "name", "seed_density_g_per_tray", "blackout_days",
  "ideal_harvest_day", "expected_yield_oz_per_tray",
];

export async function GET(_req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_crops")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crops: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  for (const field of REQUIRED) {
    if (body[field] === undefined || body[field] === null) {
      return NextResponse.json({ error: `Missing field: ${field}` }, { status: 400 });
    }
  }

  const admin = createAdminClient();
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farm_id = farms?.[0]?.id;
  if (!farm_id) return NextResponse.json({ error: "No farm configured" }, { status: 500 });

  const { data, error } = await (admin as any)
    .from("microgreen_crops")
    .insert({ ...body, farm_id })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crop: data }, { status: 201 });
}
```

- [ ] **Step 3: Implement `src/app/api/microgreens/crops/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_crops")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ crop: data });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_crops")
    .update(body)
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ crop: data });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  // Soft delete via is_active=false
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await (admin as any)
    .from("microgreen_crops")
    .update({ is_active: false })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run, confirm tests pass**

```bash
npm test -- crops
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/microgreens/crops/ tests/api/microgreens/crops.test.ts
git commit -m "feat: microgreen crops CRUD API + tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: API — Demand CRUD

**Files:**
- Create: `src/app/api/microgreens/demand/route.ts`
- Create: `src/app/api/microgreens/demand/[id]/route.ts`
- Create: `tests/api/microgreens/demand.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { GET, POST } = await import("@/app/api/microgreens/demand/route");

describe("POST /api/microgreens/demand", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a demand row", async () => {
    const sb = makeSupabaseMock({ microgreen_demand: [] });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/demand", {
      method: "POST",
      body: JSON.stringify({
        crop_id: "c1", restaurant_id: "r1",
        day_of_week: 4, target_oz: 16,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_demand).toHaveLength(1);
  });

  it("rejects out-of-range day_of_week", async () => {
    const sb = makeSupabaseMock({});
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/demand", {
      method: "POST",
      body: JSON.stringify({ crop_id: "c1", day_of_week: 9, target_oz: 5 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/microgreens/demand", () => {
  it("returns all demand rows joined with crop and restaurant", async () => {
    const sb = makeSupabaseMock({
      microgreen_demand: [
        { id: "d1", crop_id: "c1", restaurant_id: "r1", day_of_week: 4, target_oz: 8 },
      ],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/demand");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.demand).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement `src/app/api/microgreens/demand/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_demand")
    .select("*, crop:microgreen_crops(id,name), restaurant:restaurants(id,name)")
    .order("crop_id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demand: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.crop_id) return NextResponse.json({ error: "Missing crop_id" }, { status: 400 });
  if (body.day_of_week == null || body.day_of_week < 0 || body.day_of_week > 6)
    return NextResponse.json({ error: "day_of_week must be 0-6" }, { status: 400 });
  if (!body.target_oz || body.target_oz <= 0)
    return NextResponse.json({ error: "target_oz must be > 0" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_demand")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ demand: data }, { status: 201 });
}
```

- [ ] **Step 3: Implement `src/app/api/microgreens/demand/[id]/route.ts`** — mirror crops/[id]/route.ts but for the `microgreen_demand` table (PATCH, DELETE). Same structure as Task 10 Step 3.

- [ ] **Step 4: Run, confirm pass**

```bash
npm test -- demand
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/microgreens/demand/ tests/api/microgreens/demand.test.ts
git commit -m "feat: microgreen demand CRUD API + tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: API — sow-plan GET endpoint

**Files:**
- Create: `src/app/api/microgreens/sow-plan/route.ts`
- Create: `tests/api/microgreens/sow-plan.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, vi } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { GET } = await import("@/app/api/microgreens/sow-plan/route");

describe("GET /api/microgreens/sow-plan", () => {
  it("returns a plan with sow_today/advance_today/harvest_today buckets", async () => {
    const sb = makeSupabaseMock({
      microgreen_crops: [],
      microgreen_demand: [],
      microgreen_batches: [],
      microgreen_trays: [],
      delivery_dates: [],
      delivery_items: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/sow-plan");
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.plan).toHaveProperty("sow_today");
    expect(body.plan).toHaveProperty("advance_today");
    expect(body.plan).toHaveProperty("harvest_today");
    expect(body.plan).toHaveProperty("overdue");
    expect(body.plan).toHaveProperty("warnings");
  });
});
```

- [ ] **Step 2: Implement `src/app/api/microgreens/sow-plan/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { computeSowPlan } from "@/lib/microgreens/sowPlan";
import { PLAN_HORIZON_DAYS } from "@/lib/microgreens/constants";

export const revalidate = 60; // 60s cache

export async function GET(_req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + PLAN_HORIZON_DAYS * 24 * 3600 * 1000);
  const today = now.toISOString().slice(0, 10);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const lookbackStart = new Date(now.getTime() - 60 * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);

  const [{ data: crops }, { data: demand }, { data: batches }, { data: trays },
    { data: deliveryDates }, { data: history }] = await Promise.all([
    (admin as any).from("microgreen_crops").select("*").eq("is_active", true),
    (admin as any).from("microgreen_demand").select("*"),
    (admin as any).from("microgreen_batches").select("*"),
    (admin as any).from("microgreen_trays").select("*"),
    (admin as any).from("delivery_dates")
      .select("delivery_date").gte("delivery_date", today).lte("delivery_date", horizonIso),
    (admin as any).from("delivery_items")
      .select("item_id, quantity_oz, deliveries!inner(delivery_date)")
      .gte("deliveries.delivery_date", lookbackStart),
  ]);

  // Flatten the historical join into the shape sowPlan expects
  const historicalDeliveryItems = (history ?? []).map((row: any) => ({
    item_id: row.item_id,
    quantity_oz: Number(row.quantity_oz ?? 0),
    delivery_date: row.deliveries?.delivery_date,
  })).filter((r: any) => r.delivery_date);

  const plan = computeSowPlan({
    crops: crops ?? [],
    demand: demand ?? [],
    batches: batches ?? [],
    trays: trays ?? [],
    deliveryDates: (deliveryDates ?? []).map((d: any) => d.delivery_date),
    historicalDeliveryItems,
    now,
  });

  return NextResponse.json({ plan });
}
```

- [ ] **Step 3: Run, confirm tests pass**

```bash
npm test -- sow-plan
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/microgreens/sow-plan/ tests/api/microgreens/sow-plan.test.ts
git commit -m "feat: sow-plan API endpoint with 60s cache

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: API — batches POST (sow event)

**Files:**
- Create: `src/app/api/microgreens/batches/route.ts`
- Create: `src/app/api/microgreens/batches/[id]/route.ts`
- Create: `tests/api/microgreens/batches.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/microgreens/batches/route");

describe("POST /api/microgreens/batches", () => {
  it("creates a batch + N trays", async () => {
    const sb = makeSupabaseMock({
      microgreen_crops: [{
        id: "c1", name: "Broccoli", presoak_hours: 0, presprout_hours: 0,
        blackout_days: 3, ideal_harvest_day: 10, keep_in_blackout: false,
      }],
      microgreen_batches: [],
      microgreen_trays: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/batches", {
      method: "POST",
      body: JSON.stringify({
        crop_id: "c1", sow_date: "2026-05-17", tray_count: 4,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_trays).toHaveLength(4);
    expect(sb._data.microgreen_trays[0].tray_label).toBe("BR-0517-01");
    expect(sb._data.microgreen_trays[3].tray_label).toBe("BR-0517-04");
    expect(sb._data.microgreen_trays[0].status).toBe("blackout"); // no soak
  });

  it("uses 'soaking' status when crop has presoak_hours > 0", async () => {
    const sb = makeSupabaseMock({
      microgreen_crops: [{
        id: "c1", name: "Pea Shoot", presoak_hours: 8, presprout_hours: 18,
        blackout_days: 3, ideal_harvest_day: 10, keep_in_blackout: false,
      }],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/batches", {
      method: "POST",
      body: JSON.stringify({ crop_id: "c1", sow_date: "2026-05-17", tray_count: 2 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_trays[0].status).toBe("soaking");
  });
});
```

- [ ] **Step 2: Implement `src/app/api/microgreens/batches/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { initialStatusForCrop } from "@/lib/microgreens/stages";
import { buildTrayLabel } from "@/lib/microgreens/trayLabel";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { crop_id, sow_date, tray_count, seed_lot, notes } = body;
  if (!crop_id || !sow_date || !tray_count || tray_count < 1) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: crop, error: cropErr } = await (admin as any)
    .from("microgreen_crops").select("*").eq("id", crop_id).single();
  if (cropErr || !crop) return NextResponse.json({ error: "Crop not found" }, { status: 404 });

  const sowDateObj = new Date(sow_date + "T00:00:00Z");
  const blackoutEnd = new Date(sowDateObj.getTime() + crop.blackout_days * 24 * 3600 * 1000);
  const harvestDate = new Date(sowDateObj.getTime() + crop.ideal_harvest_day * 24 * 3600 * 1000);
  const status = initialStatusForCrop(crop);

  const { data: batch, error: batchErr } = await (admin as any)
    .from("microgreen_batches")
    .insert({
      crop_id, sow_date, tray_count,
      soak_started_at: status === "soaking" ? new Date().toISOString() : null,
      planned_blackout_end: blackoutEnd.toISOString().slice(0, 10),
      planned_harvest_date: harvestDate.toISOString().slice(0, 10),
      seed_lot: seed_lot ?? null,
      notes: notes ?? null,
    })
    .select().single();
  if (batchErr) return NextResponse.json({ error: batchErr.message }, { status: 500 });

  const trays = Array.from({ length: tray_count }, (_, i) => ({
    batch_id: batch.id,
    tray_label: buildTrayLabel(crop.name, sowDateObj, i + 1),
    status,
    sow_date,
    blackout_start: status === "blackout" ? sow_date : null,
  }));
  const { error: trayErr } = await (admin as any).from("microgreen_trays").insert(trays);
  if (trayErr) return NextResponse.json({ error: trayErr.message }, { status: 500 });

  return NextResponse.json({ batch, tray_count }, { status: 201 });
}
```

- [ ] **Step 3: Implement `src/app/api/microgreens/batches/[id]/route.ts`** — GET only, returning the batch + its trays + crop.

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: batch } = await (admin as any)
    .from("microgreen_batches")
    .select("*, crop:microgreen_crops(*)")
    .eq("id", params.id)
    .maybeSingle();
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: trays } = await (admin as any)
    .from("microgreen_trays")
    .select("*")
    .eq("batch_id", params.id)
    .order("tray_label");

  return NextResponse.json({ batch, trays: trays ?? [] });
}
```

- [ ] **Step 4: Run, confirm pass + commit**

```bash
npm test -- batches
git add src/app/api/microgreens/batches/ tests/api/microgreens/batches.test.ts
git commit -m "feat: microgreen batches API (POST sow event creates batch+trays)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: API — Trays advance, terminate, harvests

**Files:**
- Create: `src/app/api/microgreens/trays/[id]/route.ts`
- Create: `src/app/api/microgreens/trays/[id]/advance/route.ts`
- Create: `src/app/api/microgreens/trays/[id]/terminate/route.ts`
- Create: `src/app/api/microgreens/harvests/route.ts`
- Create: `src/app/api/microgreens/harvests/[id]/route.ts`
- Create: `tests/api/microgreens/trays-advance.test.ts`
- Create: `tests/api/microgreens/harvests.test.ts`

- [ ] **Step 1: Write failing tests for advance**

```ts
// tests/api/microgreens/trays-advance.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/microgreens/trays/[id]/advance/route");

describe("POST /api/microgreens/trays/:id/advance", () => {
  it("advances blackout -> light and sets light_start", async () => {
    const sb = makeSupabaseMock({
      microgreen_trays: [{
        id: "t1", batch_id: "b1", status: "blackout",
        sow_date: "2026-05-14", blackout_start: "2026-05-14",
      }],
      microgreen_batches: [{ id: "b1", crop_id: "c1" }],
      microgreen_crops: [{
        id: "c1", name: "Broccoli", keep_in_blackout: false,
        blackout_days: 3, ideal_harvest_day: 10,
      }],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/x", { method: "POST" });
    const res = await POST(req, { params: { id: "t1" } });
    expect(res.status).toBe(200);
    const tray = sb._data.microgreen_trays[0];
    expect(tray.status).toBe("light");
    expect(tray.light_start).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement `src/app/api/microgreens/trays/[id]/advance/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { nextStatus } from "@/lib/microgreens/stages";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: tray } = await (admin as any)
    .from("microgreen_trays").select("*").eq("id", params.id).maybeSingle();
  if (!tray) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: batch } = await (admin as any)
    .from("microgreen_batches").select("*").eq("id", tray.batch_id).maybeSingle();
  const { data: crop } = await (admin as any)
    .from("microgreen_crops").select("*").eq("id", batch.crop_id).maybeSingle();

  const newStatus = nextStatus(crop, tray.status);
  if (!newStatus || newStatus === "harvesting" || newStatus === "terminated") {
    return NextResponse.json({ error: "Use harvest endpoint instead" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const updates: any = { status: newStatus };
  if (newStatus === "blackout") updates.blackout_start = today;
  if (newStatus === "light") updates.light_start = today;

  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .update(updates)
    .eq("id", params.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tray: data });
}
```

- [ ] **Step 3: Implement `src/app/api/microgreens/trays/[id]/terminate/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { lost, lost_reason } = body;
  const status = lost ? "lost" : "terminated";
  if (lost && !lost_reason) {
    return NextResponse.json({ error: "lost_reason required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .update({
      status,
      terminated_at: new Date().toISOString(),
      lost_reason: lost ? lost_reason : null,
    })
    .eq("id", params.id)
    .select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tray: data });
}
```

- [ ] **Step 4: Implement `src/app/api/microgreens/trays/[id]/route.ts`** — GET + PATCH (notes, location). Same pattern as crops/[id]/route.ts.

- [ ] **Step 5: Write failing tests for harvests**

```ts
// tests/api/microgreens/harvests.test.ts
import { describe, it, expect, vi } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/microgreens/harvests/route");

describe("POST /api/microgreens/harvests", () => {
  it("creates a harvest event and moves single-cut tray to harvesting then terminated", async () => {
    const sb = makeSupabaseMock({
      microgreen_trays: [{ id: "t1", batch_id: "b1", status: "light", sow_date: "2026-05-07" }],
      microgreen_batches: [{ id: "b1", crop_id: "c1" }],
      microgreen_crops: [{ id: "c1", is_continuous_harvest: false }],
      microgreen_harvests: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/x", {
      method: "POST",
      body: JSON.stringify({ tray_id: "t1", yield_oz: 8 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_harvests).toHaveLength(1);
    expect(sb._data.microgreen_trays[0].status).toBe("terminated");
  });

  it("for continuous-harvest, leaves tray in 'harvesting'", async () => {
    const sb = makeSupabaseMock({
      microgreen_trays: [{ id: "t1", batch_id: "b1", status: "light", sow_date: "2026-04-20" }],
      microgreen_batches: [{ id: "b1", crop_id: "c1" }],
      microgreen_crops: [{ id: "c1", is_continuous_harvest: true, productive_life_days: 30 }],
      microgreen_harvests: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/x", {
      method: "POST",
      body: JSON.stringify({ tray_id: "t1", yield_oz: 3 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(sb._data.microgreen_trays[0].status).toBe("harvesting");
  });
});
```

- [ ] **Step 6: Implement `src/app/api/microgreens/harvests/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_harvests")
    .select("*, tray:microgreen_trays(id, tray_label, batch_id, batch:microgreen_batches(crop:microgreen_crops(name)))")
    .order("harvested_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ harvests: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tray_id, yield_oz, delivery_id, restaurant_id, notes } = body;
  if (!tray_id || yield_oz == null || yield_oz < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: tray } = await (admin as any)
    .from("microgreen_trays").select("*").eq("id", tray_id).maybeSingle();
  if (!tray) return NextResponse.json({ error: "Tray not found" }, { status: 404 });

  const { data: batch } = await (admin as any)
    .from("microgreen_batches").select("crop_id").eq("id", tray.batch_id).maybeSingle();
  const { data: crop } = await (admin as any)
    .from("microgreen_crops").select("is_continuous_harvest").eq("id", batch.crop_id).maybeSingle();

  const now = new Date().toISOString();
  const { data: harvest, error: hErr } = await (admin as any)
    .from("microgreen_harvests")
    .insert({
      tray_id, yield_oz, unit: "oz",
      delivery_id: delivery_id ?? null,
      restaurant_id: restaurant_id ?? null,
      notes: notes ?? null,
      harvested_at: now,
    })
    .select().single();
  if (hErr) return NextResponse.json({ error: hErr.message }, { status: 500 });

  // Move tray status
  const update: any = {};
  if (tray.status === "light" || tray.status === "blackout") {
    update.status = "harvesting";
    update.harvesting_start = now;
  }
  if (!crop.is_continuous_harvest) {
    update.status = "terminated";
    update.terminated_at = now;
  }
  if (Object.keys(update).length) {
    await (admin as any).from("microgreen_trays").update(update).eq("id", tray_id);
  }

  return NextResponse.json({ harvest }, { status: 201 });
}
```

- [ ] **Step 7: Implement `src/app/api/microgreens/harvests/[id]/route.ts`** — DELETE only (admin needs to undo a harvest event occasionally). Same pattern as other [id] routes.

- [ ] **Step 8: Run all API tests + commit**

```bash
npm test -- microgreens
git add src/app/api/microgreens/ tests/api/microgreens/
git commit -m "feat: tray advance/terminate + harvest event APIs

Single-cut crops auto-terminate on first harvest event. Continuous-harvest
crops stay in 'harvesting' until manually terminated.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: Admin nav update + shared UI primitives

**Files:**
- Modify: `src/components/admin/BottomNav.tsx`
- Create: `src/components/admin/microgreens/StageBadge.tsx`
- Create: `src/components/admin/microgreens/StageTimeline.tsx`

- [ ] **Step 1: Add "Micro" entry to BottomNav**

Edit `src/components/admin/BottomNav.tsx`. Add a `Sprout` icon from `lucide-react` and insert into `NAV_ITEMS`:

```tsx
import { Home, ClipboardList, PackageOpen, Sprout, BarChart3, LogOut } from "lucide-react";

const NAV_ITEMS: { label: string; Icon: LucideIcon; href: string }[] = [
  { label: "Home", Icon: Home, href: "/admin/dashboard" },
  { label: "Orders", Icon: ClipboardList, href: "/admin/orders" },
  { label: "Deliveries", Icon: PackageOpen, href: "/admin/deliveries" },
  { label: "Micro", Icon: Sprout, href: "/admin/microgreens" },
  { label: "Reports", Icon: BarChart3, href: "/admin/reports" },
];
```

Note: this expands the bottom nav from 4 → 5 primary items + sign-out. On a 375px viewport that's ~62px per tab — still ≥ 44px touch target. Confirm by inspecting the nav on mobile after deploy.

- [ ] **Step 2: Create `src/components/admin/microgreens/StageBadge.tsx`**

```tsx
import { cn } from "@/lib/utils";
import type { MicrogreenTrayStatus } from "@/types/database";
import { TRAY_STATUS_LABELS, TRAY_STATUS_COLORS } from "@/lib/microgreens/constants";

export function StageBadge({ status, className }: { status: MicrogreenTrayStatus; className?: string }) {
  return (
    <span className={cn(
      "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
      TRAY_STATUS_COLORS[status],
      className,
    )}>
      {TRAY_STATUS_LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 3: Create `src/components/admin/microgreens/StageTimeline.tsx`**

A visual timeline showing the four stages with the current one highlighted.

```tsx
import { cn } from "@/lib/utils";
import type { MicrogreenTrayStatus, MicrogreenCrop } from "@/types/database";

const STAGES: MicrogreenTrayStatus[] = ["soaking", "blackout", "light", "harvesting"];
const STAGE_LABELS: Record<MicrogreenTrayStatus, string> = {
  soaking: "Soak", blackout: "Blackout", light: "Light",
  harvesting: "Harvest", terminated: "Done", lost: "Lost",
};

export function StageTimeline({
  current,
  crop,
}: {
  current: MicrogreenTrayStatus;
  crop: MicrogreenCrop;
}) {
  // Hide soak step when crop has no soak phase
  const visible = STAGES.filter((s) =>
    !(s === "soaking" && crop.presoak_hours === 0 && crop.presprout_hours === 0)
  ).filter((s) =>
    !(s === "light" && crop.keep_in_blackout)
  );
  const currentIdx = visible.indexOf(current);

  return (
    <div className="flex items-center gap-1 text-xs">
      {visible.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn(
              "px-2 py-0.5 rounded-full whitespace-nowrap",
              i < currentIdx && "bg-farm-green/15 text-farm-green",
              i === currentIdx && "bg-farm-green text-white font-medium",
              i > currentIdx && "bg-farm-muted/15 text-farm-muted",
            )}
          >
            {STAGE_LABELS[s]}
          </div>
          {i < visible.length - 1 && <span className="text-farm-muted">→</span>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Build to confirm no TypeScript errors**

```bash
npm run build
```
Expected: build succeeds. (No new tests for this task — visual components.)

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/BottomNav.tsx src/components/admin/microgreens/
git commit -m "feat: microgreens nav entry + StageBadge + StageTimeline

Adds Sprout icon entry to admin bottom nav. StageBadge for compact
status display, StageTimeline for visual progression on tray detail.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 16: Crops list + new/edit pages

**Files:**
- Create: `src/components/admin/microgreens/CropForm.tsx`
- Create: `src/app/admin/microgreens/crops/page.tsx`
- Create: `src/app/admin/microgreens/crops/new/page.tsx`
- Create: `src/app/admin/microgreens/crops/[id]/page.tsx`

- [ ] **Step 1: Create `CropForm.tsx`** — client component, used by both new and edit pages.

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GROWING_MEDIA } from "@/lib/microgreens/constants";
import type { MicrogreenCrop } from "@/types/database";

type Props = {
  initial?: Partial<MicrogreenCrop>;
  items: Array<{ id: string; name: string }>;
};

export function CropForm({ initial, items }: Props) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const isEdit = !!initial?.id;

  const [form, setForm] = useState<any>({
    name: initial?.name ?? "",
    variety: initial?.variety ?? "",
    item_id: initial?.item_id ?? "",
    seed_density_g_per_tray: initial?.seed_density_g_per_tray ?? 20,
    presoak_hours: initial?.presoak_hours ?? 0,
    presprout_hours: initial?.presprout_hours ?? 0,
    bury_seed: initial?.bury_seed ?? false,
    weight_during_blackout: initial?.weight_during_blackout ?? false,
    blackout_days: initial?.blackout_days ?? 3,
    keep_in_blackout: initial?.keep_in_blackout ?? false,
    ideal_harvest_day: initial?.ideal_harvest_day ?? 10,
    harvest_min_days: initial?.harvest_min_days ?? null,
    harvest_max_days: initial?.harvest_max_days ?? null,
    expected_yield_oz_per_tray: initial?.expected_yield_oz_per_tray ?? 8,
    is_continuous_harvest: initial?.is_continuous_harvest ?? false,
    productive_life_days: initial?.productive_life_days ?? null,
    growing_medium: initial?.growing_medium ?? ["soil"],
    preferred_medium: initial?.preferred_medium ?? "soil",
    tray_size: initial?.tray_size ?? "10x20",
    notes: initial?.notes ?? "",
  });

  function update<K extends keyof typeof form>(key: K, val: any) {
    setForm((f: any) => ({ ...f, [key]: val }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const url = isEdit
        ? `/api/microgreens/crops/${initial!.id}`
        : "/api/microgreens/crops";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(form),
      });
      if (res.ok) router.push("/admin/microgreens/crops");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-xl">
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Identity</legend>
        <label className="block">
          <span className="block text-sm">Name</span>
          <input className="input w-full" value={form.name}
            onChange={(e) => update("name", e.target.value)} required />
        </label>
        <label className="block">
          <span className="block text-sm">Variety (optional)</span>
          <input className="input w-full" value={form.variety}
            onChange={(e) => update("variety", e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-sm">Linked Item (optional)</span>
          <select className="input w-full" value={form.item_id ?? ""}
            onChange={(e) => update("item_id", e.target.value || null)}>
            <option value="">— none —</option>
            {items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
          </select>
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Seed</legend>
        <label className="block">
          <span className="block text-sm">Seed density (g/tray)</span>
          <input type="number" step="0.1" className="input w-full"
            value={form.seed_density_g_per_tray}
            onChange={(e) => update("seed_density_g_per_tray", Number(e.target.value))} required />
        </label>
        <label className="block">
          <span className="block text-sm">Presoak hours</span>
          <input type="number" className="input w-full"
            value={form.presoak_hours}
            onChange={(e) => update("presoak_hours", Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="block text-sm">Presprout hours</span>
          <input type="number" className="input w-full"
            value={form.presprout_hours}
            onChange={(e) => update("presprout_hours", Number(e.target.value))} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.bury_seed}
            onChange={(e) => update("bury_seed", e.target.checked)} />
          <span>Bury seed at sow</span>
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Growth</legend>
        <label className="block">
          <span className="block text-sm">Blackout days</span>
          <input type="number" className="input w-full"
            value={form.blackout_days}
            onChange={(e) => update("blackout_days", Number(e.target.value))} required />
        </label>
        <label className="block">
          <span className="block text-sm">Ideal harvest day (total days from sow)</span>
          <input type="number" className="input w-full"
            value={form.ideal_harvest_day}
            onChange={(e) => update("ideal_harvest_day", Number(e.target.value))} required />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.weight_during_blackout}
            onChange={(e) => update("weight_during_blackout", e.target.checked)} />
          <span>Weight during blackout</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.keep_in_blackout}
            onChange={(e) => update("keep_in_blackout", e.target.checked)} />
          <span>Keep in blackout entire grow (corn/popcorn)</span>
        </label>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Yield</legend>
        <label className="block">
          <span className="block text-sm">Expected yield (oz/tray)</span>
          <input type="number" step="0.1" className="input w-full"
            value={form.expected_yield_oz_per_tray}
            onChange={(e) => update("expected_yield_oz_per_tray", Number(e.target.value))} required />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_continuous_harvest}
            onChange={(e) => update("is_continuous_harvest", e.target.checked)} />
          <span>Continuous harvest (nasturtium / wheatgrass second-cut)</span>
        </label>
        {form.is_continuous_harvest && (
          <label className="block">
            <span className="block text-sm">Productive life (days)</span>
            <input type="number" className="input w-full"
              value={form.productive_life_days ?? ""}
              onChange={(e) => update("productive_life_days", Number(e.target.value) || null)} />
          </label>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold uppercase tracking-wide">Medium</legend>
        <div className="flex gap-3">
          {GROWING_MEDIA.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox"
                checked={form.growing_medium.includes(m)}
                onChange={(e) => update("growing_medium",
                  e.target.checked
                    ? [...form.growing_medium, m]
                    : form.growing_medium.filter((x: string) => x !== m))} />
              <span className="capitalize">{m}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="block text-sm">Notes</span>
        <textarea className="input w-full" rows={3} value={form.notes}
          onChange={(e) => update("notes", e.target.value)} />
      </label>

      <button type="submit" className="btn-primary" disabled={isPending}>
        {isPending ? "Saving…" : isEdit ? "Save" : "Create crop"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/microgreens/crops/page.tsx`** — list of crops.

```tsx
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { Sprout } from "lucide-react";
import type { MicrogreenCrop } from "@/types/database";

export default async function CropsListPage() {
  const admin = createAdminClient();
  const { data } = await (admin as any)
    .from("microgreen_crops")
    .select("*")
    .order("name");
  const crops = (data ?? []) as MicrogreenCrop[];

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Variety Library"
        subtitle={`${crops.length} crops · ${crops.filter((c) => c.is_active).length} active`}
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-3xl mx-auto">
        <Link href="/admin/microgreens/crops/new" className="btn-primary mb-4 inline-block">
          + New crop
        </Link>
        <ul className="space-y-2">
          {crops.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/microgreens/crops/${c.id}`}
                className="block p-3 rounded border border-farm-muted/20 hover:border-farm-green flex items-center gap-3"
              >
                <Sprout className="w-5 h-5 text-farm-green" />
                <div className="flex-1">
                  <div className="font-medium">{c.name}{c.variety ? ` — ${c.variety}` : ""}</div>
                  <div className="text-xs text-farm-muted">
                    {c.ideal_harvest_day}d total · {c.blackout_days}d blackout · ~{c.expected_yield_oz_per_tray}oz/tray
                    {c.is_continuous_harvest && " · continuous"}
                    {!c.is_active && " · inactive"}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create `src/app/admin/microgreens/crops/new/page.tsx`**

```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { CropForm } from "@/components/admin/microgreens/CropForm";

export default async function NewCropPage() {
  const admin = createAdminClient();
  const { data: items } = await (admin as any)
    .from("items").select("id, name").order("name");

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens / Crops"
        title="New Crop"
        backHref="/admin/microgreens/crops"
      />
      <div className="px-4 max-w-xl mx-auto">
        <CropForm items={items ?? []} />
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Create `src/app/admin/microgreens/crops/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { CropForm } from "@/components/admin/microgreens/CropForm";

export default async function EditCropPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: crop } = await (admin as any)
    .from("microgreen_crops").select("*").eq("id", params.id).maybeSingle();
  if (!crop) notFound();

  const { data: items } = await (admin as any)
    .from("items").select("id, name").order("name");

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens / Crops"
        title={crop.name}
        subtitle={crop.variety ?? undefined}
        backHref="/admin/microgreens/crops"
      />
      <div className="px-4 max-w-xl mx-auto">
        <CropForm initial={crop} items={items ?? []} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify build + manual smoke test**

```bash
npm run build
npm run dev
# Visit /admin/microgreens/crops in browser, confirm list renders + create/edit work
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/microgreens/CropForm.tsx src/app/admin/microgreens/crops/
git commit -m "feat: microgreen crops list + new + edit pages

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 17: Demand grid page

**Files:**
- Create: `src/components/admin/microgreens/DemandGrid.tsx`
- Create: `src/app/admin/microgreens/demand/page.tsx`

- [ ] **Step 1: Create `DemandGrid.tsx`** — client component, inline-editable grid.

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DOW_LABELS } from "@/lib/microgreens/constants";
import type { MicrogreenCrop, MicrogreenDemand } from "@/types/database";

type Restaurant = { id: string; name: string };

type Props = {
  crops: MicrogreenCrop[];
  restaurants: Restaurant[];
  demand: MicrogreenDemand[];
};

export function DemandGrid({ crops, restaurants, demand }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");

  function findCell(crop_id: string, restaurant_id: string | null, dow: number) {
    return demand.find((d) =>
      d.crop_id === crop_id
      && (d.restaurant_id ?? null) === restaurant_id
      && d.day_of_week === dow,
    );
  }

  async function save(crop_id: string, restaurant_id: string | null, dow: number, raw: string) {
    const n = Number(raw);
    const existing = findCell(crop_id, restaurant_id, dow);
    if (!raw || n <= 0) {
      // delete if existing
      if (existing) {
        await fetch(`/api/microgreens/demand/${existing.id}`, { method: "DELETE" });
      }
    } else if (existing) {
      await fetch(`/api/microgreens/demand/${existing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ target_oz: n }),
      });
    } else {
      await fetch("/api/microgreens/demand", {
        method: "POST",
        body: JSON.stringify({ crop_id, restaurant_id, day_of_week: dow, target_oz: n }),
      });
    }
    setEditing(null);
    router.refresh();
  }

  const columns: Array<{ restaurant: Restaurant | null; dow: number; label: string }> = [];
  for (const r of restaurants) {
    for (const dow of [1, 4, 6]) { // Mon Thu Sat — Press Farm delivery days
      columns.push({ restaurant: r, dow, label: `${r.name} ${DOW_LABELS[dow]}` });
    }
  }
  // Farm-wide column
  for (const dow of [1, 4, 6]) {
    columns.push({ restaurant: null, dow, label: `Farm-wide ${DOW_LABELS[dow]}` });
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr>
            <th className="text-left p-2">Crop</th>
            {columns.map((c, i) => <th key={i} className="p-2 text-xs">{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {crops.map((c) => (
            <tr key={c.id} className="border-t border-farm-muted/15">
              <td className="p-2 font-medium">{c.name}</td>
              {columns.map((col, i) => {
                const cellKey = `${c.id}-${col.restaurant?.id ?? "null"}-${col.dow}`;
                const cell = findCell(c.id, col.restaurant?.id ?? null, col.dow);
                const isEditing = editing === cellKey;
                return (
                  <td key={i} className="p-1 text-center">
                    {isEditing ? (
                      <input
                        autoFocus
                        className="input w-16"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={() => save(c.id, col.restaurant?.id ?? null, col.dow, value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            save(c.id, col.restaurant?.id ?? null, col.dow, value);
                          if (e.key === "Escape") setEditing(null);
                        }}
                      />
                    ) : (
                      <button
                        className="px-2 py-1 hover:bg-farm-green/10 rounded min-w-[2.5rem]"
                        onClick={() => {
                          setEditing(cellKey);
                          setValue(cell ? String(cell.target_oz) : "");
                        }}
                      >
                        {cell ? `${cell.target_oz}` : "—"}
                      </button>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-farm-muted mt-4">
        Click a cell to set the weekly oz target for that crop × restaurant × delivery day.
        Empty means no manual target — the forecast sidebar will be used as a fallback.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/microgreens/demand/page.tsx`**

```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { DemandGrid } from "@/components/admin/microgreens/DemandGrid";

export default async function DemandPage() {
  const admin = createAdminClient();
  const [{ data: crops }, { data: restaurants }, { data: demand }] = await Promise.all([
    (admin as any).from("microgreen_crops").select("*").eq("is_active", true).order("name"),
    (admin as any).from("restaurants").select("id, name").order("name"),
    (admin as any).from("microgreen_demand").select("*"),
  ]);

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Demand Targets"
        subtitle="Set weekly oz targets per crop × restaurant × delivery day"
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-5xl mx-auto">
        <DemandGrid
          crops={crops ?? []}
          restaurants={restaurants ?? []}
          demand={demand ?? []}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build + smoke test + commit**

```bash
npm run build
git add src/components/admin/microgreens/DemandGrid.tsx src/app/admin/microgreens/demand/
git commit -m "feat: microgreen demand grid (inline-editable, Mon/Thu/Sat columns)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 18: Dashboard — sow / advance / harvest task cards

**Files:**
- Create: `src/components/admin/microgreens/TaskCard.tsx`
- Create: `src/components/admin/microgreens/SowModal.tsx`
- Create: `src/components/admin/microgreens/HarvestForm.tsx`
- Create: `src/app/admin/microgreens/page.tsx`

- [ ] **Step 1: Create `TaskCard.tsx`** (display-only card used by dashboard)

```tsx
import { cn } from "@/lib/utils";

export function TaskCard({
  title, subtitle, action, tone = "default", warning,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "default" | "overdue" | "warning";
  warning?: string;
}) {
  return (
    <div className={cn(
      "p-4 rounded-lg border",
      tone === "default" && "border-farm-muted/20 bg-white",
      tone === "overdue" && "border-red-400 bg-red-50",
      tone === "warning" && "border-amber-400 bg-amber-50",
    )}>
      <div className="font-medium">{title}</div>
      {subtitle && <div className="text-sm text-farm-muted mt-1">{subtitle}</div>}
      {warning && <div className="text-xs text-amber-800 mt-2">⚠ {warning}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create `SowModal.tsx`** — client component for confirming a sow task.

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SowTask } from "@/lib/microgreens/types";

export function SowModal({ task, onClose }: { task: SowTask; onClose: () => void }) {
  const router = useRouter();
  const [trayCount, setTrayCount] = useState(task.trays_to_sow);
  const [seedLot, setSeedLot] = useState("");
  const [notes, setNotes] = useState("");
  const [isPending, start] = useTransition();

  async function submit() {
    start(async () => {
      const res = await fetch("/api/microgreens/batches", {
        method: "POST",
        body: JSON.stringify({
          crop_id: task.crop.id,
          sow_date: task.sow_date,
          tray_count: trayCount,
          seed_lot: seedLot || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-lg font-semibold">
          Sow {task.crop.name}{task.crop.variety ? ` — ${task.crop.variety}` : ""}
        </h2>
        <p className="text-sm text-farm-muted mt-1">
          For delivery {task.delivery_date}. Plan: {task.trays_needed} trays needed, {task.trays_in_flight} already in flight.
        </p>
        <label className="block mt-4">
          <span className="block text-sm">Tray count</span>
          <input type="number" className="input w-full" value={trayCount}
            onChange={(e) => setTrayCount(Number(e.target.value))} />
        </label>
        <label className="block mt-3">
          <span className="block text-sm">Seed lot (optional)</span>
          <input className="input w-full" value={seedLot} onChange={(e) => setSeedLot(e.target.value)} />
        </label>
        <label className="block mt-3">
          <span className="block text-sm">Notes</span>
          <textarea className="input w-full" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" onClick={submit} disabled={isPending}>
            {isPending ? "Sowing…" : "Confirm sow"}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `HarvestForm.tsx`** — modal for logging a harvest event.

```tsx
"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { HarvestTask } from "@/lib/microgreens/types";

export function HarvestForm({
  task, deliveries, onClose,
}: {
  task: HarvestTask;
  deliveries: Array<{ id: string; delivery_date: string; restaurant_name?: string }>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [yieldOz, setYieldOz] = useState<string>("");
  const [deliveryId, setDeliveryId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isPending, start] = useTransition();

  async function submit() {
    if (!yieldOz || Number(yieldOz) <= 0) return;
    start(async () => {
      const res = await fetch("/api/microgreens/harvests", {
        method: "POST",
        body: JSON.stringify({
          tray_id: task.tray.id,
          yield_oz: Number(yieldOz),
          delivery_id: deliveryId || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-lg font-semibold">
          Log harvest — {task.tray.tray_label}
        </h2>
        <p className="text-sm text-farm-muted mt-1">
          {task.crop.name} · day {task.days_since_sow}
          {task.kind === "continuous-ongoing" && " · continuous harvest"}
        </p>
        <label className="block mt-4">
          <span className="block text-sm">Yield (oz)</span>
          <input type="number" step="0.1" className="input w-full" value={yieldOz}
            onChange={(e) => setYieldOz(e.target.value)} autoFocus />
        </label>
        <label className="block mt-3">
          <span className="block text-sm">Assign to delivery (optional)</span>
          <select className="input w-full" value={deliveryId} onChange={(e) => setDeliveryId(e.target.value)}>
            <option value="">— none —</option>
            {deliveries.map((d) => (
              <option key={d.id} value={d.id}>
                {d.delivery_date} {d.restaurant_name ? `· ${d.restaurant_name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block mt-3">
          <span className="block text-sm">Notes</span>
          <textarea className="input w-full" rows={2} value={notes}
            onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" onClick={submit} disabled={isPending}>
            {isPending ? "Logging…" : "Log harvest"}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create dashboard page `src/app/admin/microgreens/page.tsx`**

```tsx
import Link from "next/link";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSowPlan } from "@/lib/microgreens/sowPlan";
import { PLAN_HORIZON_DAYS } from "@/lib/microgreens/constants";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic"; // sow plan must reflect today

export default async function MicrogreensDashboardPage() {
  const admin = createAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + PLAN_HORIZON_DAYS * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);
  const lookback = new Date(now.getTime() - 60 * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);

  const [{ data: crops }, { data: demand }, { data: batches }, { data: trays },
    { data: deliveryDates }, { data: history }, { data: deliveries }] = await Promise.all([
    (admin as any).from("microgreen_crops").select("*").eq("is_active", true),
    (admin as any).from("microgreen_demand").select("*"),
    (admin as any).from("microgreen_batches").select("*"),
    (admin as any).from("microgreen_trays").select("*"),
    (admin as any).from("delivery_dates").select("delivery_date")
      .gte("delivery_date", today).lte("delivery_date", horizon),
    (admin as any).from("delivery_items")
      .select("item_id, quantity_oz, deliveries!inner(delivery_date)")
      .gte("deliveries.delivery_date", lookback),
    (admin as any).from("deliveries")
      .select("id, delivery_date, restaurant:restaurants(name)")
      .gte("delivery_date", today).lte("delivery_date", horizon)
      .order("delivery_date"),
  ]);

  const historicalDeliveryItems = (history ?? []).map((r: any) => ({
    item_id: r.item_id,
    quantity_oz: Number(r.quantity_oz ?? 0),
    delivery_date: r.deliveries?.delivery_date,
  })).filter((r: any) => r.delivery_date);

  const plan = computeSowPlan({
    crops: crops ?? [], demand: demand ?? [], batches: batches ?? [], trays: trays ?? [],
    deliveryDates: (deliveryDates ?? []).map((d: any) => d.delivery_date),
    historicalDeliveryItems, now,
  });

  const flatDeliveries = (deliveries ?? []).map((d: any) => ({
    id: d.id,
    delivery_date: d.delivery_date,
    restaurant_name: d.restaurant?.name,
  }));

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Production"
        title="Microgreens"
        subtitle={`${(crops ?? []).length} crops · ${(trays ?? []).filter((t: any) => !["terminated","lost"].includes(t.status)).length} trays in flight`}
      />
      <div className="px-4 max-w-3xl mx-auto space-y-6">
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/microgreens/crops" className="badge-blue">Crops</Link>
          <Link href="/admin/microgreens/demand" className="badge-blue">Demand</Link>
          <Link href="/admin/microgreens/trays" className="badge-blue">Trays</Link>
          <Link href="/admin/microgreens/calendar" className="badge-blue">Calendar</Link>
          <Link href="/admin/microgreens/harvests" className="badge-blue">Harvests</Link>
        </nav>
        <DashboardClient plan={plan} deliveries={flatDeliveries} />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Create `src/app/admin/microgreens/DashboardClient.tsx`** (client component that owns modal state)

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskCard } from "@/components/admin/microgreens/TaskCard";
import { SowModal } from "@/components/admin/microgreens/SowModal";
import { HarvestForm } from "@/components/admin/microgreens/HarvestForm";
import type { SowPlan, SowTask, HarvestTask, AdvanceTask } from "@/lib/microgreens/types";

type Delivery = { id: string; delivery_date: string; restaurant_name?: string };

export function DashboardClient({ plan, deliveries }: { plan: SowPlan; deliveries: Delivery[] }) {
  const router = useRouter();
  const [sowing, setSowing] = useState<SowTask | null>(null);
  const [harvesting, setHarvesting] = useState<HarvestTask | null>(null);
  const overdueCount =
    plan.overdue.sow.length + plan.overdue.advance.length + plan.overdue.harvest.length;

  async function advance(task: AdvanceTask) {
    const res = await fetch(`/api/microgreens/trays/${task.tray.id}/advance`, { method: "POST" });
    if (res.ok) router.refresh();
  }

  return (
    <>
      {overdueCount > 0 && (
        <div className="p-3 rounded bg-red-50 border border-red-400 text-red-800 text-sm">
          ⚠ {overdueCount} overdue task{overdueCount > 1 ? "s" : ""}
          {plan.overdue.sow.length > 0 && ` · ${plan.overdue.sow.length} sow`}
          {plan.overdue.advance.length > 0 && ` · ${plan.overdue.advance.length} advance`}
          {plan.overdue.harvest.length > 0 && ` · ${plan.overdue.harvest.length} harvest`}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-2">Sow today</h2>
        {plan.sow_today.length === 0 ? (
          <p className="text-sm text-farm-muted">Nothing to sow today.</p>
        ) : (
          <div className="space-y-2">
            {plan.sow_today.map((t, i) => (
              <TaskCard
                key={i}
                title={`Sow ${t.trays_to_sow} trays of ${t.crop.name}`}
                subtitle={`For ${t.delivery_date} delivery · ${t.expected_oz} oz needed · ${t.trays_in_flight} in flight`}
                warning={t.is_warning ? `History suggests ${t.forecast_oz.toFixed(1)} oz (vs manual ${t.manual_oz} oz)` : undefined}
                tone={t.is_warning ? "warning" : "default"}
                action={<button className="btn-primary" onClick={() => setSowing(t)}>Mark sown</button>}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-2">Advance</h2>
        {plan.advance_today.length === 0 ? (
          <p className="text-sm text-farm-muted">No stage transitions today.</p>
        ) : (
          <div className="space-y-2">
            {plan.advance_today.map((t, i) => (
              <TaskCard
                key={i}
                title={`Move ${t.tray.tray_label} (${t.crop.name})`}
                subtitle={`${t.from_status} → ${t.to_status}`}
                action={<button className="btn-primary" onClick={() => advance(t)}>Advance</button>}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-2">Harvest</h2>
        {plan.harvest_today.length === 0 ? (
          <p className="text-sm text-farm-muted">No harvest tasks today.</p>
        ) : (
          <div className="space-y-2">
            {plan.harvest_today.map((t, i) => (
              <TaskCard
                key={i}
                title={`Harvest ${t.tray.tray_label} (${t.crop.name})`}
                subtitle={`day ${t.days_since_sow}${t.kind === "continuous-ongoing" ? " · continuous" : ""}`}
                action={<button className="btn-primary" onClick={() => setHarvesting(t)}>Log harvest</button>}
              />
            ))}
          </div>
        )}
      </section>

      {sowing && <SowModal task={sowing} onClose={() => setSowing(null)} />}
      {harvesting && <HarvestForm task={harvesting} deliveries={deliveries} onClose={() => setHarvesting(null)} />}
    </>
  );
}
```

- [ ] **Step 6: Build + smoke test + commit**

```bash
npm run build
git add src/components/admin/microgreens/TaskCard.tsx \
        src/components/admin/microgreens/SowModal.tsx \
        src/components/admin/microgreens/HarvestForm.tsx \
        src/app/admin/microgreens/page.tsx \
        src/app/admin/microgreens/DashboardClient.tsx
git commit -m "feat: microgreens dashboard — sow/advance/harvest tasks + overdue banner

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 19: Trays list + detail + batch detail + harvest log pages

**Files:**
- Create: `src/app/admin/microgreens/trays/page.tsx`
- Create: `src/app/admin/microgreens/trays/[id]/page.tsx`
- Create: `src/app/admin/microgreens/batches/[id]/page.tsx`
- Create: `src/app/admin/microgreens/harvests/page.tsx`

- [ ] **Step 1: Trays list page**

`src/app/admin/microgreens/trays/page.tsx`:

```tsx
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { StageBadge } from "@/components/admin/microgreens/StageBadge";

export default async function TraysListPage({ searchParams }: { searchParams: { status?: string } }) {
  const admin = createAdminClient();
  let q = (admin as any).from("microgreen_trays")
    .select("*, batch:microgreen_batches(crop:microgreen_crops(name))")
    .order("sow_date", { ascending: false }).limit(200);
  if (searchParams.status) q = q.eq("status", searchParams.status);
  const { data: trays } = await q;

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Trays"
        subtitle={`${(trays ?? []).length} shown`}
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-4xl mx-auto">
        <div className="mb-4 flex gap-2 text-xs">
          <Link href="/admin/microgreens/trays" className="badge-blue">All</Link>
          {["soaking", "blackout", "light", "harvesting", "terminated", "lost"].map((s) => (
            <Link key={s} href={`/admin/microgreens/trays?status=${s}`} className="badge-blue capitalize">{s}</Link>
          ))}
        </div>
        <ul className="space-y-2">
          {(trays ?? []).map((t: any) => (
            <li key={t.id}>
              <Link href={`/admin/microgreens/trays/${t.id}`}
                className="block p-3 rounded border border-farm-muted/20 hover:border-farm-green flex items-center gap-3">
                <span className="font-mono text-xs">{t.tray_label}</span>
                <span className="flex-1 text-sm">{t.batch?.crop?.name ?? "—"}</span>
                <StageBadge status={t.status} />
                <span className="text-xs text-farm-muted">{t.sow_date}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Tray detail page**

`src/app/admin/microgreens/trays/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { StageBadge } from "@/components/admin/microgreens/StageBadge";
import { StageTimeline } from "@/components/admin/microgreens/StageTimeline";

export default async function TrayDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: tray } = await (admin as any)
    .from("microgreen_trays")
    .select("*, batch:microgreen_batches(*, crop:microgreen_crops(*))")
    .eq("id", params.id).maybeSingle();
  if (!tray) notFound();

  const { data: harvests } = await (admin as any)
    .from("microgreen_harvests")
    .select("*, delivery:deliveries(delivery_date, restaurant:restaurants(name))")
    .eq("tray_id", params.id)
    .order("harvested_at", { ascending: false });

  const crop = tray.batch?.crop;
  const totalYield = (harvests ?? []).reduce((s: number, h: any) => s + Number(h.yield_oz), 0);

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens / Trays"
        title={tray.tray_label}
        subtitle={crop ? `${crop.name}${crop.variety ? ` — ${crop.variety}` : ""}` : undefined}
        backHref="/admin/microgreens/trays"
      />
      <div className="px-4 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <StageBadge status={tray.status} />
          <span className="text-sm text-farm-muted">sown {tray.sow_date}</span>
        </div>

        {crop && <StageTimeline current={tray.status} crop={crop} />}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2">
            Harvest history ({totalYield.toFixed(1)} oz total)
          </h2>
          {(harvests ?? []).length === 0 ? (
            <p className="text-sm text-farm-muted">No harvests logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(harvests ?? []).map((h: any) => (
                <li key={h.id} className="p-2 bg-white rounded border border-farm-muted/15 flex justify-between">
                  <span>{new Date(h.harvested_at).toLocaleString()}</span>
                  <span className="font-medium">{h.yield_oz} oz</span>
                  <span className="text-xs text-farm-muted">
                    {h.delivery?.delivery_date ?? "unassigned"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {tray.lost_reason && (
          <p className="text-sm text-red-700">Lost: {tray.lost_reason}</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Batch detail page**

`src/app/admin/microgreens/batches/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { StageBadge } from "@/components/admin/microgreens/StageBadge";

export default async function BatchDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: batch } = await (admin as any)
    .from("microgreen_batches")
    .select("*, crop:microgreen_crops(*)")
    .eq("id", params.id).maybeSingle();
  if (!batch) notFound();

  const { data: trays } = await (admin as any)
    .from("microgreen_trays").select("*").eq("batch_id", params.id).order("tray_label");

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens / Batches"
        title={batch.crop?.name ?? "Batch"}
        subtitle={`Sown ${batch.sow_date} · ${batch.tray_count} trays · harvest ${batch.planned_harvest_date}`}
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-2xl mx-auto">
        <ul className="space-y-1">
          {(trays ?? []).map((t: any) => (
            <li key={t.id}>
              <Link href={`/admin/microgreens/trays/${t.id}`}
                className="block p-2 rounded border border-farm-muted/15 hover:border-farm-green flex items-center gap-3">
                <span className="font-mono text-xs flex-1">{t.tray_label}</span>
                <StageBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Harvest log page**

`src/app/admin/microgreens/harvests/page.tsx`:

```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";

export default async function HarvestLogPage() {
  const admin = createAdminClient();
  const { data } = await (admin as any)
    .from("microgreen_harvests")
    .select("*, tray:microgreen_trays(tray_label, batch:microgreen_batches(crop:microgreen_crops(name))), delivery:deliveries(delivery_date)")
    .order("harvested_at", { ascending: false }).limit(200);

  return (
    <main className="pb-24">
      <EditorialHero eyebrow="Microgreens" title="Harvest Log" backHref="/admin/microgreens" />
      <div className="px-4 max-w-3xl mx-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">When</th>
              <th className="p-2">Crop</th>
              <th className="p-2">Tray</th>
              <th className="p-2">Yield</th>
              <th className="p-2">Delivery</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((h: any) => (
              <tr key={h.id} className="border-t border-farm-muted/15">
                <td className="p-2">{new Date(h.harvested_at).toLocaleString()}</td>
                <td className="p-2">{h.tray?.batch?.crop?.name ?? "—"}</td>
                <td className="p-2 font-mono text-xs">{h.tray?.tray_label ?? "—"}</td>
                <td className="p-2">{h.yield_oz} oz</td>
                <td className="p-2 text-xs text-farm-muted">{h.delivery?.delivery_date ?? "unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Build, smoke-test, commit**

```bash
npm run build
git add src/app/admin/microgreens/trays/ src/app/admin/microgreens/batches/ src/app/admin/microgreens/harvests/
git commit -m "feat: tray list/detail, batch detail, harvest log pages

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 20: Calendar view

**Files:**
- Create: `src/components/admin/microgreens/CalendarView.tsx`
- Create: `src/app/admin/microgreens/calendar/page.tsx`

No new dependency — uses a hand-rolled CSS-grid month view. Lighter than adding a calendar lib for a single page.

- [ ] **Step 1: Create `CalendarView.tsx`**

```tsx
"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { MicrogreenBatch, MicrogreenTray } from "@/types/database";

type Event =
  | { kind: "sow"; date: string; label: string; href: string }
  | { kind: "blackout-end"; date: string; label: string; href: string }
  | { kind: "harvest"; date: string; label: string; href: string };

const KIND_COLOR: Record<Event["kind"], string> = {
  sow: "bg-blue-500/15 text-blue-800",
  "blackout-end": "bg-amber-400/15 text-amber-800",
  harvest: "bg-farm-green/15 text-farm-green",
};

type Props = {
  batches: Array<MicrogreenBatch & { crop?: { name: string } | null }>;
};

export function CalendarView({ batches }: Props) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  const events = useMemo<Event[]>(() => {
    const out: Event[] = [];
    for (const b of batches) {
      const name = b.crop?.name ?? "?";
      out.push({
        kind: "sow", date: b.sow_date,
        label: `Sow ${b.tray_count}× ${name}`,
        href: `/admin/microgreens/batches/${b.id}`,
      });
      if (b.planned_blackout_end) {
        out.push({
          kind: "blackout-end", date: b.planned_blackout_end,
          label: `Light start: ${name}`,
          href: `/admin/microgreens/batches/${b.id}`,
        });
      }
      out.push({
        kind: "harvest", date: b.planned_harvest_date,
        label: `Harvest ${name}`,
        href: `/admin/microgreens/batches/${b.id}`,
      });
    }
    return out;
  }, [batches]);

  // Build a 6-week grid (42 days) starting on the Sunday on or before day 1.
  const first = new Date(Date.UTC(month.y, month.m, 1));
  const startDow = first.getUTCDay();
  const start = new Date(first);
  start.setUTCDate(1 - startDow);

  const days: Array<{ iso: string; inMonth: boolean; events: Event[] }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      iso,
      inMonth: d.getUTCMonth() === month.m,
      events: events.filter((e) => e.date === iso),
    });
  }

  function shift(delta: number) {
    setMonth(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  }

  const monthLabel = new Date(Date.UTC(month.y, month.m, 1))
    .toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button className="btn-secondary" onClick={() => shift(-1)}>← Prev</button>
        <h2 className="font-semibold">{monthLabel}</h2>
        <button className="btn-secondary" onClick={() => shift(1)}>Next →</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="p-1 text-center font-medium text-farm-muted">{d}</div>
        ))}
        {days.map((day) => (
          <div
            key={day.iso}
            className={`min-h-[80px] border border-farm-muted/15 p-1 ${day.inMonth ? "bg-white" : "bg-farm-muted/5"}`}
          >
            <div className="text-[10px] text-farm-muted">{day.iso.slice(-2)}</div>
            <div className="space-y-0.5">
              {day.events.map((e, i) => (
                <Link key={i} href={e.href} className={`block px-1 py-0.5 rounded ${KIND_COLOR[e.kind]} text-[10px] truncate`}>
                  {e.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/admin/microgreens/calendar/page.tsx`**

```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { CalendarView } from "@/components/admin/microgreens/CalendarView";

export default async function CalendarPage() {
  const admin = createAdminClient();
  // Pull batches spanning ~3 months around today
  const today = new Date();
  const back = new Date(today.getTime() - 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const fwd  = new Date(today.getTime() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data } = await (admin as any)
    .from("microgreen_batches")
    .select("*, crop:microgreen_crops(name)")
    .gte("sow_date", back).lte("planned_harvest_date", fwd);

  return (
    <main className="pb-24">
      <EditorialHero eyebrow="Microgreens" title="Calendar" backHref="/admin/microgreens" />
      <div className="px-4 max-w-4xl mx-auto">
        <CalendarView batches={data ?? []} />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Build + smoke + commit**

```bash
npm run build
git add src/components/admin/microgreens/CalendarView.tsx src/app/admin/microgreens/calendar/
git commit -m "feat: microgreens calendar view (sow/blackout-end/harvest events)

Color-coded month grid with sow (blue), light-start (amber), harvest (green)
events linked to their batches. Hand-rolled CSS grid — no new dep.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 21: Final integration + acceptance test pass

**Files:**
- Modify: `CLAUDE.md` — bump last applied migration to 045 and add microgreens to "What's Currently Shipping"

- [ ] **Step 1: Full test pass**

```bash
npm test
```
Expected: all tests pass.

- [ ] **Step 2: Full build pass**

```bash
npm run build
```
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Manual acceptance walkthrough**

In dev (`npm run dev`), verify each acceptance criterion from the spec:

1. [ ] Bottom-nav shows "Micro" entry; clicking navigates to `/admin/microgreens`.
2. [ ] Dashboard renders three task cards (sow/advance/harvest) with overdue banner if applicable.
3. [ ] `/admin/microgreens/crops` lists seeded crops; create/edit/deactivate work.
4. [ ] `/admin/microgreens/demand` grid allows inline edit per (crop × restaurant × dow).
5. [ ] "Mark sown" creates a batch + N tray rows; status is correct (soaking vs blackout).
6. [ ] Stage advance buttons transition status + set stage-start dates.
7. [ ] Harvest modal creates a harvest event row; single-cut trays auto-terminate.
8. [ ] Continuous-harvest crops accept multiple harvest events without terminating.
9. [ ] Calendar view renders sow / light-start / harvest events.
10. [ ] Sow plan produces correct task counts; in-flight trays subtract from `trays_to_sow`.
11. [ ] Chef order flow (`/order`) still works unchanged (regression check).
12. [ ] No new dependencies added without confirmation (only Vitest at Task 1 + lucide `Sprout` — already in repo).

- [ ] **Step 4: Update CLAUDE.md**

Edit `CLAUDE.md`:
- In the migrations table, append rows for whatever has shipped: `| 043 | seed_inventory | (parallel spec) |`, `| 044 | repricing_2026_05_18 | item pricing adjustments |`, and `| 045 | microgreens_module | microgreen_crops, _demand, _batches, _trays, _harvests + status enum |`.
- Replace "Last applied: **022**" with "Last applied: **045**".
- In "What's Currently Shipping" add: `- /admin/microgreens — production module: variety library, demand targets, sow plan dashboard, tray ops, harvest event log, calendar.`

- [ ] **Step 5: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for microgreens module (migration 045)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

- [ ] **Step 6: Verify deployed Vercel preview**

After push, check the Vercel preview URL. Confirm:
- Dashboard renders without server errors.
- API routes respond (use browser devtools network tab).
- Mobile layout (375px DevTools) — bottom nav fits 5 items + sign-out, touch targets remain ≥ 44px.

---

## Self-Review (post-plan)

**1. Spec coverage**
- Variety library → Task 3 (seed) + Task 5 (types) + Task 10 (API) + Task 16 (UI).
- Manual demand → Task 11 (API) + Task 17 (UI).
- Sow plan algorithm → Task 9 (pure logic) + Task 12 (API) + Task 18 (dashboard).
- Tray ops (sow/advance/terminate) → Task 13 + Task 14 (APIs) + Task 18 (UI).
- Harvest events (single-cut + continuous) → Task 14 (API) + Task 18 (form) + Task 19 (log page).
- Calendar view → Task 20.
- Auto-forecast → Task 8 (pure) + Task 18 (warning banner in dashboard).
- Tray list + detail + batch detail → Task 19.
- Stage timeline visual → Task 15.
- Admin nav entry → Task 15.
- Migration 045 + RLS + indexes → Task 2.
- Seed data → Tasks 3 + 4.
- TS types → Task 5.
- Test setup → Task 1.
- Vitest unit + API tests for highest-risk paths → Tasks 6–14.

**2. Placeholder scan**
- Task 3 Step 2: "Add the remaining ~66 entries to SEED_CROPS" — directs the engineer to a clearly-defined conversion procedure (explicit rules in the comment block above). Not a placeholder but a delegated transformation task. Worth flagging as the single largest piece of mechanical work.
- All other tasks contain runnable code.

**3. Type consistency**
- `MicrogreenCrop`, `MicrogreenTray`, `MicrogreenBatch`, `MicrogreenHarvest`, `MicrogreenDemand` consistent across tasks.
- `SowPlan`, `SowTask`, `AdvanceTask`, `HarvestTask` — all defined in Task 5, consumed by Tasks 9, 12, 18.
- `initialStatusForCrop`, `nextStatus`, `isReadyToAdvance`, `isReadyToHarvest`, `buildTrayLabel`, `cropInitials`, `computeForecast`, `computeSowPlan` — names match across tests and implementations.
- API routes consistently use `createAdminClient` (admin operations) + `createClient` (auth check). Matches the existing project pattern.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-17-microgreen-manager.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**




