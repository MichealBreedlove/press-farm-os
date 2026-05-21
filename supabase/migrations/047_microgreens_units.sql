-- Migration 047: Microgreens unit-based yield + demand
--
-- Press Farm sells microgreens in LG / SM / EA to-go containers,
-- not ounces. (GB / Green Bin bulk is intentionally NOT a microgreon
-- unit per Micheal 2026-05-21 — it's used for other crops but not micros.)
-- The yield model is "alternatives" — one tray of Pea Shoots yields
-- *either* 4 LG to-gos *or* 8 SM to-gos *or* 32 EA bags, depending on
-- what's been ordered.
--
-- Old columns (microgreen_crops.expected_yield_oz_per_tray,
-- microgreen_demand.target_oz) are left in place for rollback safety;
-- code stops referencing them in the same release.

ALTER TABLE microgreen_crops
  ADD COLUMN IF NOT EXISTS yield_per_tray jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN microgreen_crops.yield_per_tray IS
  'Map of unit code (lg/sm/ea) to alternative yield per tray. Example: {"lg": 4, "sm": 8, "ea": 32} — one tray yields 4 LG OR 8 SM OR 32 EA, depending on packing decision.';

ALTER TABLE microgreen_demand
  ADD COLUMN IF NOT EXISTS target_quantity numeric(8,2),
  ADD COLUMN IF NOT EXISTS target_unit text;

ALTER TABLE microgreen_demand
  DROP CONSTRAINT IF EXISTS microgreen_demand_target_unit_check;

ALTER TABLE microgreen_demand
  ADD CONSTRAINT microgreen_demand_target_unit_check
  CHECK (target_unit IS NULL OR target_unit IN ('lg','sm','ea','gb'));

COMMENT ON COLUMN microgreen_demand.target_quantity IS
  'How many of target_unit are needed on this day_of_week. Replaces target_oz.';
COMMENT ON COLUMN microgreen_demand.target_unit IS
  'Unit code (lg/sm/ea). Must match a key in microgreen_crops.yield_per_tray for sow planning to compute trays_needed.';

-- Allow target_oz to be unset on new rows (target_quantity + target_unit is the
-- new way). Default to 0 so any code path still depending on it doesn't crash.
ALTER TABLE microgreen_demand ALTER COLUMN target_oz DROP NOT NULL;
ALTER TABLE microgreen_demand ALTER COLUMN target_oz SET DEFAULT 0;
