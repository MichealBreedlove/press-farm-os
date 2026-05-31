-- Migration 065: Planting-plan follow-ups (cleanup + 2027 fruit repeat)
-- =============================================================================
-- Follow-ups to migration 064 (the 12-month plantings calendar):
--
--   1. Remove 3 legacy test rows in `plantings` (the pre-064 Basil x2 + Carrots
--      stubs). They are the only rows with NULL notes; every 064 row carries a
--      notes signature.
--
--   2. Add a 2027 "planned" repeat of the 13 real tomato/pepper varieties so the
--      recurring cycle includes next year's warm crop (the 064 rows captured
--      only the actual 2026 crop, status 'growing'). Transplant ~Apr 15 2027,
--      status 'planned'. season stays 2026 to group with the rest of the
--      forward-plan rows (which all use season 2026).
--
-- NOTE: No planting_tasks are generated. That table was intentionally dropped
-- in migration 062 (superseded by `farm_tasks`). The plantings calendar's own
-- sow/harvest dates are the schedule; recurring operational reminders are meant
-- to come from the per-item recurring-sow engine (items.recurring_sow_*), not a
-- one-time bulk insert that would flood /admin/tasks.
-- =============================================================================

BEGIN;

-- 1. Drop legacy test rows (NULL notes = not from the 064 plan) -----------------
DELETE FROM plantings WHERE notes IS NULL;

-- 2. 2027 recurring tomato/pepper plan -----------------------------------------
WITH farm AS (
  SELECT id FROM farms WHERE name = 'Press Farm' ORDER BY created_at LIMIT 1
),
recur (crop_name, variety, dtm, nursery) AS (
  VALUES
   ('Tomato', 'Red Currant',            70, 42),
   ('Tomato', 'Early Girl',             55, 42),
   ('Tomato', 'Sun Gold',               57, 42),
   ('Tomato', 'Unity',                  70, 42),
   ('Tomato', 'Brown Sugar',            70, 42),
   ('Tomato', 'Black Krim',             80, 42),
   ('Tomato', 'Black Prince',           70, 42),
   ('Tomato', 'Spears Tennessee Green', 80, 42),
   ('Pepper', 'Marconi Red',            80, 56),
   ('Pepper', 'Habanada',               75, 56),
   ('Pepper', 'Jimmy Nardello',         85, 56),
   ('Pepper', 'Aji Dulce',              90, 56),
   ('Pepper', 'Aji Amarillo',          100, 56)
)
INSERT INTO plantings (
  farm_id, item_id, crop_name, variety, category, growing_location,
  planting_stock, sowing_method, sow_date, transplant_date,
  days_to_maturity, harvest_start, harvest_end,
  quantity, quantity_unit, beds, bed_feet, location, status, season, notes
)
SELECT
  f.id,
  (SELECT i.id FROM items i WHERE i.farm_id = f.id AND lower(i.name) = lower(r.crop_name) LIMIT 1),
  r.crop_name, r.variety, 'fruit', 'in_ground', 'transplants', 'Transplant',
  (DATE '2027-04-15' - (r.nursery || ' days')::interval)::date,
  DATE '2027-04-15', r.dtm,
  (DATE '2027-04-15' + (r.dtm || ' days')::interval)::date,
  (DATE '2027-04-15' + ((r.dtm + 21) || ' days')::interval)::date,
  12, 'plants', 1, 25, 'Field Beds', 'planned', 2026,
  'Recurring 2027 plan - tomato/pepper varieties repeated from 2026 crop.'
FROM recur r
CROSS JOIN farm f;

COMMIT;
