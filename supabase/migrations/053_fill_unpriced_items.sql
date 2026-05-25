-- ============================================
-- Press Farm OS — Migration 053: Fill unpriced items + consolidate Bean→Beans
--
-- Follow-up to 051/052, from the 2026-05-22 catalog audit. Eight items
-- had empty unit_prices (would import future deliveries at $0):
--
--   Aptenia          → lg $15,  sm $7.50
--   Persimmon        → ea $3.75
--   Purple Stardust  → lg $15,  sm $7.50
--   Fennel (fronds)  → lg $10,  sm $5      (non-bulbing CA variety; leaf price)
--   Baby Squash      → lg $25,  sm $12.50, gb $150, lbs $4
--   Olive Branches   → gb $20               (GB = case = box price)
--   Bean             → consolidated into "Beans" (legacy ea stub)
--   Cover Crop       → left unpriced (umbrella term; individual cover crops
--                      — hairy vetch / fava / pea tendrils / oats — tracked
--                      separately for cleaner accounting, per Micheal)
--
-- Prices sourced from Micheal's master price key. Updates are scoped to
-- unit_prices = '{}' so we never clobber an item that's already priced.
-- ============================================

BEGIN;

-- ============================================
-- A. Consolidate "Bean" (legacy ea-only stub) into "Beans"
--    (collision-safe pattern from 048/049)
-- ============================================
DO $$
DECLARE
  old_id uuid;
  new_id uuid;
BEGIN
  SELECT id INTO old_id FROM items WHERE name = 'Bean'  LIMIT 1;
  SELECT id INTO new_id FROM items WHERE name = 'Beans' LIMIT 1;

  IF old_id IS NULL OR new_id IS NULL THEN
    RETURN;
  END IF;

  -- availability_items UNIQUE(item_id, restaurant_id, delivery_date)
  WITH collisions AS (
    SELECT d.id AS dup_avail_id, c.id AS canon_avail_id
    FROM availability_items d
    JOIN availability_items c
      ON c.item_id       = new_id
     AND c.restaurant_id = d.restaurant_id
     AND c.delivery_date = d.delivery_date
    WHERE d.item_id = old_id
  )
  UPDATE order_items oi
  SET availability_item_id = collisions.canon_avail_id
  FROM collisions
  WHERE oi.availability_item_id = collisions.dup_avail_id;

  DELETE FROM availability_items
  WHERE item_id = old_id
    AND (restaurant_id, delivery_date) IN (
      SELECT restaurant_id, delivery_date FROM availability_items WHERE item_id = new_id
    );
  UPDATE availability_items SET item_id = new_id WHERE item_id = old_id;

  -- price_catalog UNIQUE(item_id, unit, effective_date)
  DELETE FROM price_catalog
  WHERE item_id = old_id
    AND (unit, effective_date) IN (
      SELECT unit, effective_date FROM price_catalog WHERE item_id = new_id
    );
  UPDATE price_catalog SET item_id = new_id WHERE item_id = old_id;

  -- Flat FK reassignment
  UPDATE delivery_items   SET item_id = new_id WHERE item_id = old_id;
  UPDATE price_history    SET item_id = new_id WHERE item_id = old_id;
  UPDATE event_requests   SET item_id = new_id WHERE item_id = old_id;
  UPDATE plantings        SET item_id = new_id WHERE item_id = old_id;
  UPDATE microgreen_crops SET item_id = new_id WHERE item_id = old_id;
  UPDATE seeds            SET item_id = new_id WHERE item_id = old_id;
  UPDATE items            SET parent_item_id = new_id WHERE parent_item_id = old_id;

  DELETE FROM items WHERE id = old_id;
END $$;

-- ============================================
-- B. Fill unit_prices + default_price for the unpriced items.
--    Scoped to unit_prices = '{}' so already-priced rows are untouched.
-- ============================================
UPDATE items SET unit_prices = '{"lg":15,"sm":7.5}'::jsonb,            default_price = 15.00
  WHERE name = 'Aptenia'         AND unit_prices = '{}'::jsonb;

UPDATE items SET unit_prices = '{"ea":3.75}'::jsonb,                   default_price = 3.75
  WHERE name = 'Persimmon'       AND unit_prices = '{}'::jsonb;

UPDATE items SET unit_prices = '{"lg":15,"sm":7.5}'::jsonb,            default_price = 15.00
  WHERE name = 'Purple Stardust' AND unit_prices = '{}'::jsonb;

UPDATE items SET unit_prices = '{"lg":10,"sm":5}'::jsonb,              default_price = 10.00
  WHERE name = 'Fennel'          AND unit_prices = '{}'::jsonb;

UPDATE items SET unit_prices = '{"lg":25,"sm":12.5,"gb":150,"lbs":4}'::jsonb, default_price = 25.00
  WHERE name = 'Baby Squash'     AND unit_prices = '{}'::jsonb;

UPDATE items SET unit_prices = '{"gb":20}'::jsonb,                     default_price = 20.00
  WHERE name = 'Olive Branches'  AND unit_prices = '{}'::jsonb;

COMMIT;
