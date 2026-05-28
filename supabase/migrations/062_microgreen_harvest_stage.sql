-- Migration 062: Microgreen harvest_stage enum + one-time timing bump.
--
-- Press Farm harvests microgreens at the Baby Green stage, not the
-- cotyledon stage the seed data was tuned for. This migration:
--   1. Adds a microgreen_harvest_stage enum.
--   2. Adds harvest_stage column to microgreen_crops (default 'baby_green').
--   3. Bumps active leaf crops' ideal_harvest_day / harvest_min_days /
--      harvest_max_days so the dashboard's "harvest today" tasks fire
--      closer to baby-green readiness.
--
-- Exception list: shoot/grain crops where "baby green" is semantically
-- nonsense are not bumped. They still get harvest_stage = 'baby_green'
-- via the column default (harmless label) but their day numbers stay put.

CREATE TYPE microgreen_harvest_stage AS ENUM ('cotyledon', 'true_leaf', 'baby_green');

ALTER TABLE microgreen_crops
  ADD COLUMN harvest_stage microgreen_harvest_stage NOT NULL DEFAULT 'baby_green';

UPDATE microgreen_crops
SET
  ideal_harvest_day = ideal_harvest_day + 5,
  harvest_min_days  = CASE WHEN harvest_min_days IS NOT NULL THEN harvest_min_days + 3 ELSE NULL END,
  harvest_max_days  = CASE WHEN harvest_max_days IS NOT NULL THEN harvest_max_days + 7 ELSE NULL END
WHERE is_active = true
  AND name NOT IN (
    'Pea Shoot', 'Sunflower', 'Wheatgrass', 'Popcorn', 'Corn', 'Nasturtium'
  );

-- Sanity check: blackout_within_harvest constraint (blackout_days <= ideal_harvest_day)
-- holds because we only added days; never subtracted, never modified blackout_days.
