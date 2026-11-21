-- 109: DATA — every microgreen task happens in the Greenhouse
--
-- Micheal 2026-11-21. Sets location_place = 'greenhouse' on the open
-- microgreen tasks (cron-generated, or linked to a microgreen crop/batch);
-- 26 rows on 2026-11-21. New ones get it from the microgreens generator.
-- Applied 2026-11-21 via the Supabase MCP.

UPDATE farm_tasks
SET location_place = 'greenhouse', location_quadrant = NULL, location_rows = NULL, updated_at = now()
WHERE (source = 'microgreens-auto' OR microgreen_crop_id IS NOT NULL OR microgreen_batch_id IS NOT NULL)
  AND status IN ('open', 'snoozed')
  AND location_place IS DISTINCT FROM 'greenhouse';
