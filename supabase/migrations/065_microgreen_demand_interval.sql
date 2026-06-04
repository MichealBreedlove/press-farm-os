-- Migration 065: Microgreen demand recurrence interval
--
-- Until now microgreen_demand was implicitly weekly: a row with day_of_week = 6
-- meant "every Saturday." Micheal needs coarser cadences ("1 tray every 2 weeks").
--
-- interval_weeks adds that: 1 = every week (the old behavior, default), 2 = every
-- other week, 3 = every third week, etc. The recurrence is anchored to
-- effective_from (or a fixed farm epoch when null): a delivery date counts only
-- when floor(weeks since anchor) % interval_weeks == 0. day_of_week still selects
-- WHICH day; interval_weeks selects WHICH weeks.
--
-- Backward compatible: existing rows default to 1 and behave exactly as before.

ALTER TABLE microgreen_demand
  ADD COLUMN IF NOT EXISTS interval_weeks int NOT NULL DEFAULT 1
  CHECK (interval_weeks >= 1);

-- Drop a stale leftover: migration 047 made target_oz optional (DROP NOT NULL,
-- DEFAULT 0) but never dropped its `target_oz > 0` CHECK. That contradiction
-- silently rejects every insert that uses the new target_quantity/target_unit
-- shape without also supplying a positive target_oz — including the demand
-- editor's own POST. Remove it so the unit-based path works.
ALTER TABLE microgreen_demand
  DROP CONSTRAINT IF EXISTS microgreen_demand_target_oz_check;

COMMENT ON COLUMN microgreen_demand.interval_weeks IS
  'Recurrence interval in weeks. 1 = every week (default). 2 = every other week, etc. Anchored to effective_from (or farm epoch when null): a delivery date counts only when floor(weeks since anchor) % interval_weeks == 0. day_of_week chooses the day; this chooses the weeks.';
