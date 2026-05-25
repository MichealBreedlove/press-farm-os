-- ============================================
-- Press Farm OS — Migration 052: Item name casing & consolidation
--
-- Follow-up to 051. Cleans up lowercase / variant item names surfaced
-- while filling in $0 delivery prices (2026-05-22 audit):
--   - "Ethiopian kale" → "Ethiopian Kale"
--   - "wild cress"     → "Wild Cress"
--   - "Garlic scapes"  → "Garlic Scapes"
--   - "forget me nots" → fold into existing "Forget-Me-Nots"
--   - "pea flower"     → fold into existing "Pea Flowers"
--
-- Uses the same collision-safe consolidation pattern as 051: where a
-- canonical target already exists, references are moved (handling the
-- availability_items + price_catalog UNIQUE keys) and the dup is deleted;
-- otherwise the item is simply renamed in place.
-- ============================================

BEGIN;

DO $$
DECLARE
  pairs text[][] := ARRAY[
    ['Ethiopian kale', 'Ethiopian Kale'],
    ['wild cress',     'Wild Cress'],
    ['Garlic scapes',  'Garlic Scapes'],
    ['forget me nots', 'Forget-Me-Nots'],
    ['pea flower',     'Pea Flowers']
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
      UPDATE items SET name = pair[2] WHERE id = old_id;
      CONTINUE;
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
        SELECT restaurant_id, delivery_date
        FROM availability_items
        WHERE item_id = new_id
      );

    UPDATE availability_items SET item_id = new_id WHERE item_id = old_id;

    -- price_catalog UNIQUE(item_id, unit, effective_date)
    DELETE FROM price_catalog
    WHERE item_id = old_id
      AND (unit, effective_date) IN (
        SELECT unit, effective_date
        FROM price_catalog
        WHERE item_id = new_id
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
  END LOOP;
END $$;

COMMIT;
