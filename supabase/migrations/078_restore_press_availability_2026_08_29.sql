-- 078: DATA FIX — restore Press's clobbered 2026-08-29 availability.
--
-- What happened (2026-08-28, ~3:05pm PDT): the availability editor page
-- fetched ALL availability rows for the date in one un-ranged select.
-- With 4 restaurants × 293 catalog items = 1,172 rows, Supabase's silent
-- 1,000-row response cap dropped ~172 rows — concentrated in Press's
-- tail (items ~F onward in sort order). The editor seeds missing rows as
-- "unavailable", and "Save All Restaurants" wrote that back: Press went
-- from 29 orderable items to 7 while Events / Press Bar / Under-Study
-- kept ~29 each. Chefs at Press then saw almost nothing to order (and
-- 08-31 would inherit the same list via rollover).
--
-- Code fix shipped alongside: src/lib/fetch-all.ts paginates the editor
-- page's fetch (plus the availability-list and calendar reads).
--
-- Repair rule (deliberately conservative):
--   For Press on 2026-08-29, flip a row back ONLY when
--     • its status is 'unavailable', AND
--     • Under-Study's 2026-08-29 row for the same item IS orderable
--       (Under-Study survived the Friday save intact, so it reflects
--       that day's real intent — every restored status also matches
--       Press's own last good state from 08-27 where one existed), AND
--     • Press's 08-27 row was orderable or absent (absent = item first
--       published on Friday, e.g. Flower Bouquet / Radish / Sorrel).
--   The restored status/limited_qty copy Press's 08-27 row when it
--   exists, else Under-Study's 08-29 row. Items turned off for BOTH
--   restaurants on Friday (e.g. Beans) stay off — that was a real edit.
--
-- Idempotent: re-running matches no rows once statuses are restored.
-- Rollback: set status back to 'unavailable' for the touched item_ids
-- (cycle_notes are untouched; no marker column exists on this table —
-- the touched set is recoverable from this file's WHERE clause).

WITH press AS (
  SELECT id FROM restaurants WHERE name = 'Press'
),
understudy AS (
  SELECT id FROM restaurants WHERE name = 'Under-Study'
),
repair AS (
  SELECT
    p29.id AS row_id,
    COALESCE(p27.status, u29.status) AS new_status,
    COALESCE(p27.limited_qty, u29.limited_qty) AS new_limited_qty
  FROM availability_items p29
  JOIN understudy u ON TRUE
  JOIN availability_items u29
    ON u29.item_id = p29.item_id
   AND u29.delivery_date = '2026-08-29'
   AND u29.restaurant_id = u.id
   AND u29.status IN ('available', 'limited')
  LEFT JOIN availability_items p27
    ON p27.item_id = p29.item_id
   AND p27.delivery_date = '2026-08-27'
   AND p27.restaurant_id = p29.restaurant_id
  WHERE p29.delivery_date = '2026-08-29'
    AND p29.restaurant_id = (SELECT id FROM press)
    AND p29.status = 'unavailable'
    AND (p27.status IS NULL OR p27.status IN ('available', 'limited'))
)
UPDATE availability_items ai
SET status = repair.new_status,
    limited_qty = repair.new_limited_qty,
    updated_at = NOW()
FROM repair
WHERE ai.id = repair.row_id;
