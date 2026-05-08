-- 036_labor_clock_times.sql
-- Adds time-of-day fields to labor_entries so the admin logs a real
-- shift (time in / lunch out / lunch in / time out) instead of a single
-- "hours" number. The hours column stays as the canonical total — app
-- code computes it from the four times before insert. Existing rows
-- (only hours, no times) keep working; they just don't show times in
-- the UI.

ALTER TABLE labor_entries
  ADD COLUMN IF NOT EXISTS time_in TIME,
  ADD COLUMN IF NOT EXISTS lunch_out TIME,
  ADD COLUMN IF NOT EXISTS lunch_in TIME,
  ADD COLUMN IF NOT EXISTS time_out TIME;

COMMENT ON COLUMN labor_entries.time_in IS
  'Shift start time-of-day (24-hour). Optional for legacy rows pre-036.';
COMMENT ON COLUMN labor_entries.lunch_out IS
  'Lunch break start. NULL means no lunch break.';
COMMENT ON COLUMN labor_entries.lunch_in IS
  'Lunch break end. NULL means no lunch break.';
COMMENT ON COLUMN labor_entries.time_out IS
  'Shift end time-of-day (24-hour). Optional for legacy rows pre-036.';
