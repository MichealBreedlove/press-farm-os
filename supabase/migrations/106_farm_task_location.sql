-- 106: Where a farm task happens
--
--   location_place     'farm' | 'greenhouse' | 'press' | 'understudy'
--   location_quadrant  field quadrant number (farm)
--   location_rows      free text, e.g. "5-6" or "4, 7"
--
-- All optional. Each step of a multi-step task has its own location (sow in
-- the greenhouse → transplant to Quadrant 3, rows 5-6). Formatting for the
-- portals lives in src/lib/tasks/location.ts (EN/ES).
-- Additive. Applied 2026-11-21 via the Supabase MCP.
-- Rollback: ALTER TABLE farm_tasks DROP COLUMN location_place,
--   DROP COLUMN location_quadrant, DROP COLUMN location_rows;

ALTER TABLE farm_tasks
  ADD COLUMN IF NOT EXISTS location_place text CHECK (location_place IS NULL OR location_place IN ('farm','greenhouse','press','understudy')),
  ADD COLUMN IF NOT EXISTS location_quadrant smallint CHECK (location_quadrant IS NULL OR location_quadrant BETWEEN 1 AND 20),
  ADD COLUMN IF NOT EXISTS location_rows text CHECK (location_rows IS NULL OR char_length(location_rows) <= 40);
