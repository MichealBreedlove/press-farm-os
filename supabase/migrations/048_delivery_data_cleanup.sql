-- ============================================
-- Press Farm OS — Migration 048: Delivery data cleanup
--
-- Per Micheal 2026-05-22 audit of pressfarmdeliveries20260522.csv:
--   - Rename Persimmon Leaf → Persimmon (end-of-season chop-down fruit, not leaves)
--   - Consolidate singulars into plurals: Fig → Figs, Carrot → Carrots
--   - Title-case lowercase item names
--   - Consolidate bare "Nasturtium Leaf" under canonical "Nasturtium" (= leaves)
--   - Fix Press 2026-04-02 Nasturtium row: 100 LG @ $15 → 400 EA @ $0.30
--   - Fix four Nasturtium 1 LG @ $0.40 rows → 400 EA @ $0.40
--   - Fix Figs $25 LBS rows → $25 LG (1-LG-to-go boxes, not pound prices)
--   - Rename restaurant "Understudy" → "Under-Study"
--   - Dedupe 2026-02-05 Press (entire 15-line delivery double-imported)
--   - Strip 'â' mojibake from delivery notes (UTF-8 em-dash artifact)
--
-- $0-priced rows and other duplicate candidates are surfaced via
-- SELECT queries at the bottom for hand-review (commented out).
-- ============================================

BEGIN;

-- ============================================
-- A. Item catalog consolidations
-- Helper: move all FK refs from old_id → new_id, then delete old item.
-- ============================================

DO $$
DECLARE
  pairs text[][] := ARRAY[
    ['Persimmon Leaf',  'Persimmon'],
    ['Fig',             'Figs'],
    ['Carrot',          'Carrots'],
    ['Nasturtium Leaf', 'Nasturtium']
  ];
  pair text[];
  old_id uuid;
  new_id uuid;
BEGIN
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    SELECT id INTO old_id FROM items WHERE name = pair[1] LIMIT 1;
    SELECT id INTO new_id FROM items WHERE name = pair[2] LIMIT 1;

    IF old_id IS NULL THEN
      CONTINUE;
    END IF;

    IF new_id IS NULL THEN
      -- Target doesn't exist yet — just rename in place.
      UPDATE items SET name = pair[2] WHERE id = old_id;
      CONTINUE;
    END IF;

    -- Both exist: move references then delete the old row.
    -- Note: order_items has no item_id — it references availability_items.id,
    -- which we update below, so order lines follow the catalog automatically.
    UPDATE delivery_items     SET item_id = new_id WHERE item_id = old_id;
    UPDATE availability_items SET item_id = new_id WHERE item_id = old_id;
    UPDATE price_history    SET item_id = new_id WHERE item_id = old_id;
    UPDATE price_catalog    SET item_id = new_id WHERE item_id = old_id;
    UPDATE event_requests   SET item_id = new_id WHERE item_id = old_id;
    UPDATE plantings        SET item_id = new_id WHERE item_id = old_id;
    UPDATE microgreen_crops SET item_id = new_id WHERE item_id = old_id;
    UPDATE seeds            SET item_id = new_id WHERE item_id = old_id;
    UPDATE items            SET parent_item_id = new_id WHERE parent_item_id = old_id;

    DELETE FROM items WHERE id = old_id;
  END LOOP;
END $$;

-- A2. Title-case lowercase item names (no consolidation — these are unique)
UPDATE items SET name = 'Gem Marigold Leaves'      WHERE name = 'gem marigold leaves';
UPDATE items SET name = 'Ice Plant'                WHERE name = 'ice plant';
UPDATE items SET name = 'Fennel Flowers'           WHERE name = 'fennel flowers';
UPDATE items SET name = 'Hikari Turnips'           WHERE name = 'hikari turnips';
UPDATE items SET name = 'Red Veined Sorrel Leaves' WHERE name = 'large red veined sorrel leaves';

-- ============================================
-- B. Restaurant rename: Understudy → Under-Study
-- ============================================

DO $$
DECLARE
  old_id uuid;
  new_id uuid;
BEGIN
  SELECT id INTO old_id FROM restaurants WHERE name = 'Understudy'  LIMIT 1;
  SELECT id INTO new_id FROM restaurants WHERE name = 'Under-Study' LIMIT 1;

  IF old_id IS NULL THEN
    -- nothing to do
    NULL;
  ELSIF new_id IS NULL THEN
    UPDATE restaurants SET name = 'Under-Study' WHERE id = old_id;
  ELSE
    UPDATE deliveries       SET restaurant_id = new_id WHERE restaurant_id = old_id;
    UPDATE orders           SET restaurant_id = new_id WHERE restaurant_id = old_id;
    UPDATE restaurant_users SET restaurant_id = new_id WHERE restaurant_id = old_id;
    UPDATE event_requests   SET restaurant_id = new_id WHERE restaurant_id = old_id;
    DELETE FROM restaurants WHERE id = old_id;
  END IF;
END $$;

-- ============================================
-- C. delivery_items data fixes
-- (line_total is a GENERATED column — recomputes automatically)
-- ============================================

-- C1. Press 2026-04-02 Nasturtium 100 LG @ $15 → 400 EA @ $0.30
UPDATE delivery_items di
SET quantity = 400, unit = 'ea', unit_price = 0.30
FROM deliveries d
JOIN restaurants r ON r.id = d.restaurant_id
JOIN items       i ON i.name = 'Nasturtium'
WHERE di.delivery_id  = d.id
  AND di.item_id      = i.id
  AND d.delivery_date = DATE '2026-04-02'
  AND r.name          = 'Press'
  AND di.quantity     = 100
  AND di.unit         = 'lg'
  AND di.unit_price   = 15.00;

-- C2. Four Nasturtium 1 LG @ $0.40 rows → 400 EA @ $0.40
--     (CSV rows 57, 62, 393, 813 — leaves entered as 1 LG with the per-leaf price)
UPDATE delivery_items di
SET quantity = 400, unit = 'ea'
FROM items i
WHERE di.item_id    = i.id
  AND i.name        = 'Nasturtium'
  AND di.quantity   = 1
  AND di.unit       = 'lg'
  AND di.unit_price = 0.40;

-- C3. Figs $25 LBS rows → 'lg' (these were 1-LG-to-go boxes, not pound prices)
UPDATE delivery_items di
SET unit = 'lg'
FROM items i
WHERE di.item_id    = i.id
  AND i.name        = 'Figs'
  AND di.unit       = 'lbs'
  AND di.unit_price = 25.00;

-- ============================================
-- D. Dedupe Press 2026-02-05 (entire 15-line delivery double-imported)
-- ============================================

WITH dups AS (
  SELECT di.id,
         ROW_NUMBER() OVER (
           PARTITION BY di.delivery_id, di.item_id, di.quantity, di.unit, di.unit_price
           ORDER BY di.created_at, di.id
         ) AS rn
  FROM delivery_items di
  JOIN deliveries  d ON d.id = di.delivery_id
  JOIN restaurants r ON r.id = d.restaurant_id
  WHERE d.delivery_date = DATE '2026-02-05'
    AND r.name          = 'Press'
)
DELETE FROM delivery_items
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

-- ============================================
-- E. Strip 'â' mojibake from delivery notes
-- ============================================

UPDATE deliveries
SET notes = REPLACE(notes, 'â', '—')
WHERE notes LIKE '%â%';

COMMIT;

-- ============================================
-- POST-MIGRATION REVIEW (run by hand — not executed)
-- ============================================

-- $0-priced delivery rows that still need real prices filled in:
-- SELECT d.delivery_date, r.name AS restaurant, i.name AS item,
--        di.quantity, di.unit, di.unit_price, di.line_total
-- FROM delivery_items di
-- JOIN deliveries  d ON d.id = di.delivery_id
-- JOIN restaurants r ON r.id = d.restaurant_id
-- JOIN items       i ON i.id = di.item_id
-- WHERE di.unit_price = 0
-- ORDER BY d.delivery_date, i.name;

-- Other potential duplicate lines (same delivery + item + qty + unit + price, >1×):
-- SELECT d.delivery_date, r.name AS restaurant, i.name AS item,
--        di.quantity, di.unit, di.unit_price, COUNT(*) AS copies
-- FROM delivery_items di
-- JOIN deliveries  d ON d.id = di.delivery_id
-- JOIN restaurants r ON r.id = d.restaurant_id
-- JOIN items       i ON i.id = di.item_id
-- GROUP BY d.delivery_date, r.name, i.name, di.quantity, di.unit, di.unit_price
-- HAVING COUNT(*) > 1
-- ORDER BY d.delivery_date;
