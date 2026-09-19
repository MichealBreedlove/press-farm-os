-- Migration 079: Microgreens fall 2026 season reset
--
-- DATA FIX — Micheal (2026-09-19): "Remove all microgreens from the schedule.
-- We are starting over." The greenhouse lineup for fall 2026 is:
--
--   Borage · Fava tips · Pea Tendrils · Mustard frills · Calvin peas /
--   Frilly peas · New Zealand Spinach · Nasturtium · Gem Marigold · Chervil
--
-- The "schedule" the sow planner (src/lib/microgreens/sowPlan.ts) and the
-- nightly task cron (src/lib/tasks/regenerate-microgreens.ts) build from is:
-- microgreen_demand (targets) + non-terminated microgreen_trays (in flight)
-- + is_active crops. This migration clears all three and reactivates only
-- the fall lineup.
--
-- What it does (all reversible except the demand delete — those 12 rows are
-- listed in the rollback notes at the bottom):
--   1. Deletes every microgreen_demand row (12 rows: Amaranth, Borage,
--      Chervil, Fennel, Kale, Mustard ×2, Pea ×2, Shiso ×2, Sunflower).
--   2. Terminates every tray still in flight (31 trays across 10 batches,
--      all sown 2026-08-14, never harvested, all past their planned harvest
--      date). Batches + trays stay as history; nothing is deleted.
--   3. Supersedes the 24 open microgreens-auto farm_tasks (the cron would do
--      this on its next run anyway — an empty plan supersedes everything).
--   4. Deactivates all 74 crops, then reactivates the 9 fall-lineup rows,
--      tidies their variety labels, links catalog items where the match is
--      unambiguous, and gives them the 1-tray = 1-LG yield default the
--      previous demand rows used, so demand entry works without a
--      "missing yield config" warning.
--   5. Inserts New Zealand Spinach (not previously in the variety library).
--      Timing defaults are estimates — see the row's notes.
--
-- Deliberately NOT touched: manual farm_tasks (field-crop sow/transplant
-- work), planter boxes, seeds inventory, items catalog.
--
-- Idempotent: re-running is a no-op (guards on status / is_active / EXISTS).

-- ─── 1. Demand ─────────────────────────────────────────────────────────
DELETE FROM microgreen_demand;

-- ─── 2. In-flight trays ────────────────────────────────────────────────
UPDATE microgreen_trays
SET status        = 'terminated',
    terminated_at = now(),
    notes         = concat_ws(' · ', notes, 'Closed by fall 2026 season reset (migration 079)')
WHERE status NOT IN ('terminated', 'lost');

-- ─── 3. Open auto-generated tasks ──────────────────────────────────────
UPDATE farm_tasks
SET status            = 'superseded',
    superseded_at     = now(),
    superseded_reason = 'Fall 2026 season reset (migration 079)'
WHERE source = 'microgreens-auto'
  AND status IN ('open', 'snoozed');

-- ─── 4. Crop library: deactivate everything, reactivate the fall lineup ─
UPDATE microgreen_crops SET is_active = false WHERE is_active = true;

-- Fava Bean → labelled as Fava Tips, linked to the "Fava Tips" catalog item.
UPDATE microgreen_crops
SET variety = 'Tips',
    item_id = COALESCE(item_id, (SELECT id FROM items WHERE name = 'Fava Tips' AND is_archived = false LIMIT 1))
WHERE name = 'Fava Bean' AND variety IS NULL;

-- Pea Shoot → the generic "Pea Tendrils" crop, linked to the Pea Tendrils item.
UPDATE microgreen_crops
SET name    = 'Pea Tendrils',
    item_id = COALESCE(item_id, (SELECT id FROM items WHERE name = 'Pea Tendrils' AND is_archived = false LIMIT 1))
WHERE name = 'Pea Shoot' AND variety IS NULL;

-- Pea / Calvin → also sells as Pea Tendrils (Pea / Frilly is already linked).
UPDATE microgreen_crops
SET item_id = COALESCE(item_id, (SELECT id FROM items WHERE name = 'Pea Tendrils' AND is_archived = false LIMIT 1))
WHERE name = 'Pea' AND variety = 'Calvin';

-- Mustard → Mustard Frills. No active catalog item matches; left unlinked.
UPDATE microgreen_crops
SET variety = 'Frills'
WHERE name = 'Mustard' AND variety IS NULL;

-- Borage → the micros_leaves "Borage" item (not the flowers item).
UPDATE microgreen_crops
SET item_id = COALESCE(item_id, (SELECT id FROM items WHERE name = 'Borage' AND category = 'micros_leaves' AND is_archived = false LIMIT 1))
WHERE name = 'Borage' AND variety IS NULL;

-- Chervil → "Chervil" item.
UPDATE microgreen_crops
SET item_id = COALESCE(item_id, (SELECT id FROM items WHERE name = 'Chervil' AND is_archived = false LIMIT 1))
WHERE name = 'Chervil' AND variety IS NULL;

-- Marigold / Gem → "Gem Marigold" item.
UPDATE microgreen_crops
SET item_id = COALESCE(item_id, (SELECT id FROM items WHERE name = 'Gem Marigold' AND is_archived = false LIMIT 1))
WHERE name = 'Marigold' AND variety = 'Gem';

-- ─── 5. New Zealand Spinach (new variety) ──────────────────────────────
INSERT INTO microgreen_crops (
  farm_id, item_id, name, variety,
  seed_density_g_per_tray, presoak_hours, presprout_hours, bury_seed,
  weight_during_blackout, blackout_days, keep_in_blackout,
  ideal_harvest_day, harvest_min_days, harvest_max_days,
  expected_yield_oz_per_tray, is_continuous_harvest, productive_life_days,
  harvest_stage, growing_medium, preferred_medium, tray_size,
  yield_per_tray, notes, is_active
)
SELECT
  f.id,
  (SELECT id FROM items WHERE name = 'New Zealand Spinach' AND is_archived = false LIMIT 1),
  'New Zealand Spinach', NULL,
  25, 24, 0, true,
  false, 0, false,
  35, 28, 45,
  8, true, 60,
  'baby_green', '{soil}', 'soil', '10x20',
  '{"lg": 1}'::jsonb,
  'Added for the fall 2026 greenhouse season (migration 079). Timing is an ESTIMATE, not from the variety spreadsheet: Tetragonia seed is large and slow — soak 24 h, germinates in 7–14 d, harvest as cut-and-come-again baby leaf from ~day 35. Adjust after the first sow.',
  true
FROM farms f
WHERE NOT EXISTS (SELECT 1 FROM microgreen_crops WHERE name = 'New Zealand Spinach')
LIMIT 1;

-- ─── Reactivate the fall lineup ────────────────────────────────────────
UPDATE microgreen_crops
SET is_active      = true,
    yield_per_tray = CASE WHEN yield_per_tray = '{}'::jsonb THEN '{"lg": 1}'::jsonb ELSE yield_per_tray END
WHERE (name = 'Borage'              AND variety IS NULL)
   OR (name = 'Fava Bean'           AND variety = 'Tips')
   OR (name = 'Pea Tendrils'        AND variety IS NULL)
   OR (name = 'Pea'                 AND variety = 'Calvin')
   OR (name = 'Pea'                 AND variety = 'Frilly')
   OR (name = 'Mustard'             AND variety = 'Frills')
   OR (name = 'New Zealand Spinach' AND variety IS NULL)
   OR (name = 'Nasturtium'          AND variety IS NULL)
   OR (name = 'Marigold'            AND variety = 'Gem')
   OR (name = 'Chervil'             AND variety IS NULL);

-- ─── Rollback notes ────────────────────────────────────────────────────
-- Crops:   UPDATE microgreen_crops SET is_active = true;  (then undo the
--          rename: name='Pea Shoot' WHERE name='Pea Tendrils'; variety=NULL
--          on Fava Bean / Mustard; DELETE the New Zealand Spinach row.)
-- Trays:   UPDATE microgreen_trays SET status='blackout'|'light', terminated_at=NULL
--          WHERE notes LIKE '%migration 079%' (NA-0814-* were 'light', rest 'blackout').
-- Tasks:   UPDATE farm_tasks SET status='open', superseded_at=NULL, superseded_reason=NULL
--          WHERE superseded_reason LIKE '%migration 079%'.
-- Demand (deleted rows, all target_quantity 1 / target_unit lg; restaurant, dow, interval, effective_from):
--   Amaranth   Press        Mon  1w
--   Borage     Press        Thu  1w
--   Chervil    Press        Sat  1w
--   Fennel     Under-Study  Sat  1w
--   Kale       Under-Study  Mon  2w  from 2026-06-01
--   Mustard    Under-Study  Sat  2w  from 2026-06-01
--   Mustard    Press        Sat  1w
--   Pea/Calvin Under-Study  Thu  1w  from 2026-08-28
--   Pea/Calvin Press        Thu  1w  from 2026-08-28
--   Shiso/Purple Under-Study Mon 1w
--   Shiso/Purple Press      Mon  1w
--   Sunflower  Under-Study  Thu  1w
