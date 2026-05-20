# Seed Inventory — Design Spec

**Date:** 2026-05-17
**Status:** Approved for implementation planning
**Migration:** 046
**Author:** Claude (Opus 4.7) with Micheal Breedlove

## Purpose

Give the Press Farm admin a first-class tool to track on-hand seed inventory, log sowings against plantings, and capture germination test results. Replaces the implicit "I think I have some basil seed in the drawer" knowledge with an auditable ledger.

## Scope

**In scope (v1):**

- Full inventory ledger of seed varieties on hand.
- Sowing audit trail that decrements quantity, optionally linked to a planting.
- Germination test history per seed.
- Lifecycle status (active / low / exhausted / discarded).
- Viability warnings driven by `packed_for_year`.
- CSV Import/Export, matching the established items/expenses/deliveries pattern.
- Optional planting linkage with a prefilled "Log sowing" shortcut.

**Out of scope (v1):**

- Restock adjustments (add a new seed row for restocks).
- Auto-decrement when a planting is created.
- Reorder suggestions / shopping lists.
- Germination test scheduling or reminders.
- Supplier directory (free-text field only).
- Expense integration (seed `cost` is recorded but does not post to `farm_expenses`).
- Public `/api/v1/seeds` endpoint (chefs don't need seed data).

## Architecture

New top-level admin resource `/admin/seeds`, sibling to items, expenses, deliveries. Follows the established EditorialHero + stat strip + tab pattern.

### Routes

```
src/app/admin/seeds/
  page.tsx                       # List view — filter/search, status badges
  [seedId]/page.tsx              # Detail — edit, sowing log, germ tests
  data/page.tsx                  # CSV Import/Export
src/app/api/seeds/
  route.ts                       # GET list, POST create
  [seedId]/route.ts              # GET, PATCH, DELETE
  [seedId]/sowings/route.ts      # POST log sowing, DELETE sowing
  [seedId]/germ-tests/route.ts   # POST log germ test, DELETE germ test
  export/route.ts                # CSV export
src/app/api/import/seeds-csv/route.ts  # CSV import
```

Adds "Seeds" entry to the admin bottom-nav.

## Database Schema (migration 046)
<!-- renumbered from 043 → 046 on 2026-05-19 to clear conflict with origin/main (043 = revoke_trigger_function_grants on origin/main after duplicate-migration cleanup) -->


Three new tables, admin-only RLS matching the `plantings` pattern.

```sql
-- 046_seed_inventory.sql

CREATE TABLE seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  variety text NOT NULL,
  initial_quantity decimal(10,2) NOT NULL,
  quantity_unit text NOT NULL,
  packed_for_year integer,
  purchase_date date,
  supplier text,
  cost decimal(10,2),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'low', 'exhausted', 'discarded')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE seed_sowings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id uuid NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  planting_id uuid REFERENCES plantings(id) ON DELETE SET NULL,
  amount_used decimal(10,2) NOT NULL,
  sown_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE seed_germination_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id uuid NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  tested_on date NOT NULL DEFAULT CURRENT_DATE,
  germination_pct decimal(5,2) NOT NULL CHECK (germination_pct >= 0 AND germination_pct <= 100),
  seeds_tested integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add optional FK from plantings → seeds
ALTER TABLE plantings ADD COLUMN seed_id uuid REFERENCES seeds(id) ON DELETE SET NULL;

-- Computed on-hand view (always correct, no triggers)
CREATE VIEW seeds_with_on_hand AS
SELECT
  s.*,
  s.initial_quantity - COALESCE(SUM(sw.amount_used), 0) AS on_hand,
  CASE
    WHEN s.initial_quantity > 0
      AND (s.initial_quantity - COALESCE(SUM(sw.amount_used), 0))
          <= s.initial_quantity * 0.20
    THEN true
    ELSE false
  END AS is_low,
  MAX(sw.sown_on) AS last_sown_on,
  (SELECT germination_pct FROM seed_germination_tests gt
    WHERE gt.seed_id = s.id ORDER BY tested_on DESC LIMIT 1) AS latest_germ_pct,
  (SELECT tested_on FROM seed_germination_tests gt
    WHERE gt.seed_id = s.id ORDER BY tested_on DESC LIMIT 1) AS latest_germ_tested_on
FROM seeds s
LEFT JOIN seed_sowings sw ON sw.seed_id = s.id
GROUP BY s.id;

-- RLS
ALTER TABLE seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_sowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_germination_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to seeds"
  ON seeds FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to seed_sowings"
  ON seed_sowings FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to seed_germination_tests"
  ON seed_germination_tests FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER update_seeds_updated_at
  BEFORE UPDATE ON seeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_seeds_item ON seeds (item_id);
CREATE INDEX idx_seeds_status ON seeds (status);
CREATE INDEX idx_seed_sowings_seed ON seed_sowings (seed_id);
CREATE INDEX idx_seed_sowings_planting ON seed_sowings (planting_id);
CREATE INDEX idx_seed_germ_tests_seed ON seed_germination_tests (seed_id);
```

### Design Notes

- **`on_hand` is a view, not a column.** `initial_quantity − sum(sowings) = on_hand`. No triggers to maintain.
- **`item_id` is `ON DELETE RESTRICT`** — protects against orphaning seeds when an item is removed.
- **Restock = new row.** Buying more of "Genovese Basil" creates a second seed entry. Keeps audit trail clean. Future enhancement (out of scope) could merge or aggregate.
- **`packed_for_year`** drives all viability warnings. Color coding: current year = green, last year = amber, 2+ years = red.

## UI Pages

### `/admin/seeds` (list)

- **EditorialHero:** eyebrow "Inventory", title "Seeds", subtitle showing counts (e.g. "47 active · 3 low · 2 expiring soon"), back to `/admin/dashboard`, "+ Add seed" CTA.
- **Stat strip:** Active · Low · Exhausted · Total cost YTD.
- **Filter row:** search box + chips for category (from `items.category`), status, "old seed only" (matches rows where `packed_for_year <= current_year - 2`).
- **Row content:** variety + crop name, `on_hand` (with unit), packed-for badge (green/amber/red by age), latest germ % if any, status badge.
- Tap row → detail.

### `/admin/seeds/[seedId]` (detail / edit)

- **EditorialHero** with the crop's flower (resolved via `flowerImageForName(item.name)`).
- **Top card:** editable fields — variety, initial_quantity, quantity_unit, packed_for_year, purchase_date, supplier, cost, status, notes. Save via PATCH.
- **"Log sowing" button** → modal: amount_used, optional planting picker (filtered to plantings with `planting_stock='seeds'` and matching `item_id` if set), sown_on (defaults to today), notes. POST to `/api/seeds/[id]/sowings`.
- **"Log germ test" button** → modal: tested_on (defaults to today), germination_pct, seeds_tested, notes. POST to `/api/seeds/[id]/germ-tests`.
- **Sowing history list:** date, amount, planting link if any, notes. Newest first. Each row has a delete control.
- **Germination test history list:** newest first. Each row has a delete control.
- **Delete seed:** only enabled if zero sowings; otherwise the button is replaced with "Set status to 'discarded'".

### `/admin/seeds/data` (Import/Export)

Exact pattern of `/admin/items/data`. EditorialHero + stat strip + Export | Import tabs + drop zone.

**CSV columns:**

```
id, item_name, variety, initial_quantity, quantity_unit,
packed_for_year, purchase_date, supplier, cost, status, notes
```

- `item_name` is the upsert match into `items` (case-insensitive). Unknown crop → row fails with "no matching item: 'XYZ'" message.
- `id` is the seed-row upsert key on round-trip (omit on first import).
- **Excluded from CSV:** sowings and germination tests. They're operational, not bulk-managed.
- Initial bulk import is fully supported.

## Planting Linkage (light touch)

Two non-breaking additions on the plantings side. Optional usage.

1. **`plantings.seed_id`** (added in migration 046). When creating a planting with `planting_stock='seeds'`, the user can pick from active seeds filtered to matching `item_id`.
2. **"Log sowing of this seed" shortcut** on the planting detail page when `seed_id` is set. Opens the sowing modal with `seed_id` and `planting_id` prefilled.

### Non-goals for linkage

- **No auto-creation of sowings** when a planting is created. A planting is intent; a sowing is reality. They happen at different moments.
- **No reverse-decrement on cancel.** If a planting is cancelled after sowing, the user manually deletes the sowing record.

## Status, Warnings, and Computed State

Driven by `seeds_with_on_hand` view + UI badges. No triggers.

| Signal | Source | Surface |
|---|---|---|
| Packed-for: current year | `packed_for_year == current_year` | No badge |
| Packed-for: 1 year old | `packed_for_year == current_year - 1` | Amber "Last year" |
| Packed-for: 2+ years | `packed_for_year <= current_year - 2` | Red "Old seed" |
| Low quantity | `is_low == true` (≤ 20% of initial) | Amber "Low" badge in list |
| Exhausted | `on_hand <= 0` | Faded row, "Exhausted" tag |
| Latest germ % | `latest_germ_pct` if present | Inline on row, no threshold warning |

The `status` column is independent and admin-controlled (e.g. set `status='discarded'` to archive without deleting).

## Rollout

- **One migration: `046_seed_inventory.sql`.** Per CLAUDE.md, schema-dependent SELECTs fail until the migration runs in the Supabase SQL editor.
- **Feature flag approach:** export a constant `SEEDS_ENABLED` (boolean, hardcoded). Set `false` in initial PRs that contain UI + API; the bottom-nav link and the `/admin/seeds` routes hide/redirect when `false`. Flip to `true` after Micheal confirms the migration ran in production.
- **Build verification:** `npm run build` must pass before each push (auto-deploy means broken push = broken prod).

## File Inventory (for the implementation plan to expand)

**New:**

- `supabase/migrations/046_seed_inventory.sql`
- `src/app/admin/seeds/page.tsx`
- `src/app/admin/seeds/[seedId]/page.tsx`
- `src/app/admin/seeds/data/page.tsx`
- `src/app/api/seeds/route.ts`
- `src/app/api/seeds/[seedId]/route.ts`
- `src/app/api/seeds/[seedId]/sowings/route.ts`
- `src/app/api/seeds/[seedId]/germ-tests/route.ts`
- `src/app/api/seeds/export/route.ts`
- `src/app/api/import/seeds-csv/route.ts`
- `src/components/admin/seeds/SeedRow.tsx`
- `src/components/admin/seeds/LogSowingModal.tsx`
- `src/components/admin/seeds/LogGermTestModal.tsx`
- `src/components/admin/seeds/SeedForm.tsx`
- `src/lib/constants.ts` — add `SEEDS_ENABLED` flag, seed status enum

**Modified:**

- `src/components/shared/BottomNav.tsx` (or admin sidebar) — add "Seeds" entry, gated on `SEEDS_ENABLED`
- `src/types/database.ts` — add `Seed`, `SeedSowing`, `SeedGerminationTest` types + view shape
- `src/types/index.ts` — enriched `SeedWithOnHand` join shape
- `src/app/admin/crop-plan/plantings/[id]/page.tsx` (or wherever planting detail lives) — add optional seed picker + "Log sowing" shortcut

## Open Items for Implementation Plan

- Decide on the seed picker control on the planting page (autocomplete vs. dropdown).
- Confirm the precise admin nav location (bottom-nav vs. sidebar entry — depends on current admin shell at time of implementation).
- Pick the EditorialHero flower asset for `/admin/seeds`.
