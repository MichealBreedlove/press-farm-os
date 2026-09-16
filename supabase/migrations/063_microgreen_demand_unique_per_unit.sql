-- Migration 063: per-unit demand rows
--
-- Migration 047 moved microgreen_demand to a per-unit model (target_quantity +
-- target_unit, one row per LG / SM / EA). The demand UI (DemandGrid CellEditor)
-- and POST /api/microgreens/demand both insert one row per unit for the same
-- crop x restaurant x day_of_week.
--
-- But the unique index from 045 keyed only on
--   (crop_id, restaurant_id, day_of_week, effective_from)
-- with no unit, so the 2nd/3rd unit on a cell hit a unique violation (silently
-- swallowed by the client fetch). Add target_unit to the key so a cell can
-- legitimately hold LG + SM + EA targets at once.

DROP INDEX IF EXISTS microgreen_demand_unique;

CREATE UNIQUE INDEX microgreen_demand_unique
  ON microgreen_demand (
    crop_id,
    COALESCE(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    day_of_week,
    COALESCE(target_unit, ''),
    COALESCE(effective_from, '0001-01-01'::date)
  );
