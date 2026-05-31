-- 064_crop_schedule_update_2026_05_31.sql
--
-- Field schedule update from Micheal (2026-05-31), reflected on the crop plan /
-- harvest forecast calendar. ALREADY APPLIED to prod on 2026-05-31 via the
-- Supabase MCP — recorded here for history. INSERTs are guarded with NOT EXISTS
-- so re-running is safe (no duplicate plantings).
--
-- Summary:
--   - Peppers (5 var) + Tomatoes (8 var), current season: pinned to a July 4 harvest start.
--   - Eggplant: created a 2026 growing row ready July 4 (none existed for the season).
--   - Ox Heart carrots: earliest succession moved to an early-August sow, ready by November.
--   - Cauliflower: created, ready by November.
--   - Patty Pan Squash: created (growing), ready to harvest ~mid-June (2-3 weeks out).
--   - Basil first succession (4 varieties): transplanting June 1.
--   - Anise Hyssop: created a 2026 row, transplanting June 1.
--   - Egyptian Starflower: created, transplanting June 1.
--   - Lavender: created (growing), ready to harvest next week (June 7).
--   - Cucumbers + Sprouting Broccoli already matched the field plan — left untouched.

BEGIN;

-- 1. Pin current-season peppers & tomatoes to a July 4 harvest start
UPDATE plantings
SET harvest_start = '2026-07-04', harvest_end = '2026-07-25', updated_at = now()
WHERE crop_name IN ('Pepper','Tomato') AND season = 2026 AND status = 'growing';

-- 2. Ox Heart carrots: sow early August, ready by November (earliest succession)
UPDATE plantings
SET sow_date = '2026-08-01', harvest_start = '2026-11-01', harvest_end = '2026-11-15',
    days_to_maturity = 92, updated_at = now()
WHERE crop_name = 'Carrots' AND variety = 'Ox Heart' AND season = 2026 AND sow_date = '2026-08-15';

-- 3. Basil first succession: transplanting June 1
UPDATE plantings
SET transplant_date = '2026-06-01', sow_date = '2026-05-04',
    planting_stock = 'transplants', status = 'planted', updated_at = now()
WHERE crop_name LIKE 'Basil,%' AND season = 2026 AND sow_date = '2026-06-01';

-- 4. Eggplant: current-season crop ready by July 4 (none existed for 2026)
INSERT INTO plantings (farm_id, item_id, crop_name, variety, category, planting_stock,
  sow_date, transplant_date, harvest_start, harvest_end, days_to_maturity, status, location, season)
SELECT
  (SELECT id FROM farms WHERE name='Press Farm'),
  (SELECT id FROM items WHERE name='Eggplant' AND category='fruit_veg'),
  'Eggplant', NULL, 'fruit', 'transplants',
  '2026-02-18','2026-04-15','2026-07-04','2026-07-25', 136, 'growing','Field Beds', 2026
WHERE NOT EXISTS (
  SELECT 1 FROM plantings WHERE crop_name='Eggplant' AND season=2026 AND status='growing');

-- 5. Cauliflower: ready by November
INSERT INTO plantings (farm_id, item_id, crop_name, variety, category, planting_stock,
  sow_date, transplant_date, harvest_start, harvest_end, days_to_maturity, status, location, season)
SELECT
  (SELECT id FROM farms WHERE name='Press Farm'),
  (SELECT id FROM items WHERE name='Cauliflower' AND category='fruit_veg'),
  'Cauliflower', NULL, 'brassicas', 'transplants',
  '2026-07-18','2026-08-22','2026-11-01','2026-11-15', 106, 'planned','Field Beds', 2026
WHERE NOT EXISTS (
  SELECT 1 FROM plantings WHERE crop_name='Cauliflower' AND season=2026);

-- 6. Patty Pan Squash: ready to harvest in ~2-3 weeks
INSERT INTO plantings (farm_id, item_id, crop_name, variety, category, planting_stock,
  sow_date, harvest_start, harvest_end, days_to_maturity, status, location, season)
SELECT
  (SELECT id FROM farms WHERE name='Press Farm'),
  NULL,
  'Squash, Patty Pan', 'Patty Pan', 'fruit', 'seeds',
  '2026-04-28','2026-06-17','2026-07-31', 50, 'growing','Field Beds', 2026
WHERE NOT EXISTS (
  SELECT 1 FROM plantings WHERE crop_name='Squash, Patty Pan' AND season=2026);

-- 7. Anise Hyssop: transplanting June 1 (no 2026 row existed)
INSERT INTO plantings (farm_id, item_id, crop_name, variety, category, planting_stock,
  sow_date, transplant_date, harvest_start, harvest_end, days_to_maturity, status, location, season)
SELECT
  (SELECT id FROM farms WHERE name='Press Farm'),
  (SELECT id FROM items WHERE name='anise hyssop' AND category='herbs_leaves'),
  'Anise Hyssop', NULL, 'herbs', 'transplants',
  '2026-04-27','2026-06-01','2026-08-10','2026-08-24', 105, 'planted','Field Beds', 2026
WHERE NOT EXISTS (
  SELECT 1 FROM plantings WHERE crop_name='Anise Hyssop' AND season=2026 AND status='planted');

-- 8. Egyptian Starflower: transplanting June 1
INSERT INTO plantings (farm_id, item_id, crop_name, variety, category, planting_stock,
  sow_date, transplant_date, harvest_start, harvest_end, days_to_maturity, status, location, season)
SELECT
  (SELECT id FROM farms WHERE name='Press Farm'),
  (SELECT id FROM items WHERE name='Egyptian Starflower' AND category='flowers'),
  'Egyptian Starflower', NULL, 'flowers', 'transplants',
  '2026-04-27','2026-06-01','2026-07-20','2026-08-17', 84, 'planted','Field Beds', 2026
WHERE NOT EXISTS (
  SELECT 1 FROM plantings WHERE crop_name='Egyptian Starflower' AND season=2026);

-- 9. Lavender: ready to harvest next week
INSERT INTO plantings (farm_id, item_id, crop_name, variety, category, planting_stock,
  harvest_start, harvest_end, status, location, season)
SELECT
  (SELECT id FROM farms WHERE name='Press Farm'),
  (SELECT id FROM items WHERE name='Lavender' AND category='herbs_leaves'),
  'Lavender', NULL, 'herbs', 'transplants',
  '2026-06-07','2026-06-21', 'growing','Field Beds', 2026
WHERE NOT EXISTS (
  SELECT 1 FROM plantings WHERE crop_name='Lavender' AND season=2026);

COMMIT;
