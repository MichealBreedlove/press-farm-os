-- ============================================
-- Press Farm OS — Migration 059: Mustard consolidation
--
-- Per Micheal 2026-05-31. The catalog held 6 tangled "Mustard"/"Mustard
-- Flowers" records (see review workbook, Bucket 2). Micheal sells a lot of
-- mustard flowers and wants exactly two clean items:
--   • Mustard Flowers (flowers)  — the high-volume seller
--   • Mustard Leaves  (herbs_leaves) — the greens
--
-- The established high-volume record was named "Mustard" but lived in the
-- flowers category with flower pricing (lg $20 / sm $10) and 215 deliveries —
-- i.e. it WAS the mustard flowers. We collapse the duplicate flower records
-- onto it, rename it "Mustard Flowers", promote a dead stub into a "Mustard
-- Leaves" anchor, and group flowers + Mizuna under the leaf (mirrors the
-- Nasturtium leaf-as-anchor pattern from migration 054).
--
-- Mustard Leaves is created unpriced on purpose — it'll surface in the $0
-- review on first delivery, to be priced then. Frilly Mustard records are a
-- distinct cultivar and are left untouched. Buckets 1 & 3 are NOT applied.
--
-- IDs (farm 5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d):
--   6bbd72d4 "Mustard"        flowers  lg20/sm10  215 deliv  → Mustard Flowers
--   f89f8d1d "Mustard Flowers" flowers  lg20/sm10    0 deliv  → fold (empty dup)
--   88159f93 "Mustard Flowers" herbs    (unpriced)   6 deliv  → fold (mislabeled)
--   a13ef191 "Mizuna"          herbs    lg12/sm6     4 deliv  → child of leaves
--   8f3b3248 "Mustard"         herbs    (unpriced)   0 deliv  → Mustard Leaves anchor
--   221ddb94 "mustard"         herbs    (unpriced)   0 deliv  → fold into leaves
-- ============================================

BEGIN;

-- Collision-safe fold helper (re-created; dropped again at the end).
-- Moves every FK ref dup→canonical, de-duping availability/price collisions,
-- then deletes the dup. Identical to the helper in migration 054.
CREATE OR REPLACE FUNCTION pf_fold_item_v2(p_dup uuid, p_canonical uuid)
RETURNS void AS $fn$
BEGIN
  IF p_dup IS NULL OR p_canonical IS NULL OR p_dup = p_canonical THEN
    RETURN;
  END IF;

  WITH collisions AS (
    SELECT d.id AS dup_avail_id, c.id AS canon_avail_id
    FROM availability_items d
    JOIN availability_items c
      ON c.item_id       = p_canonical
     AND c.restaurant_id = d.restaurant_id
     AND c.delivery_date = d.delivery_date
    WHERE d.item_id = p_dup
  )
  UPDATE order_items oi
  SET availability_item_id = collisions.canon_avail_id
  FROM collisions
  WHERE oi.availability_item_id = collisions.dup_avail_id;

  DELETE FROM availability_items
  WHERE item_id = p_dup
    AND (restaurant_id, delivery_date) IN (
      SELECT restaurant_id, delivery_date FROM availability_items WHERE item_id = p_canonical
    );
  UPDATE availability_items SET item_id = p_canonical WHERE item_id = p_dup;

  DELETE FROM price_catalog
  WHERE item_id = p_dup
    AND (unit, effective_date) IN (
      SELECT unit, effective_date FROM price_catalog WHERE item_id = p_canonical
    );
  UPDATE price_catalog SET item_id = p_canonical WHERE item_id = p_dup;

  UPDATE delivery_items   SET item_id = p_canonical WHERE item_id = p_dup;
  UPDATE price_history    SET item_id = p_canonical WHERE item_id = p_dup;
  UPDATE event_requests   SET item_id = p_canonical WHERE item_id = p_dup;
  UPDATE plantings        SET item_id = p_canonical WHERE item_id = p_dup;
  UPDATE microgreen_crops SET item_id = p_canonical WHERE item_id = p_dup;
  UPDATE seeds            SET item_id = p_canonical WHERE item_id = p_dup;
  UPDATE items            SET parent_item_id = p_canonical WHERE parent_item_id = p_dup;

  DELETE FROM items WHERE id = p_dup;
END;
$fn$ LANGUAGE plpgsql;

-- 1. Collapse the duplicate flower records onto the 215-delivery anchor.
--    Done before the rename so the UNIQUE(farm_id, name, category) index
--    doesn't trip on a second "Mustard Flowers" in the flowers category.
SELECT pf_fold_item_v2('f89f8d1d-0e37-44da-be1b-99286eeddf3a',   -- empty flowers dup (child)
                       '6bbd72d4-4557-4fb8-9fcf-ec053cd4e2a2');
SELECT pf_fold_item_v2('88159f93-7e04-4efc-9e0b-41f4197be512',   -- 6-deliv herbs-labeled flowers
                       '6bbd72d4-4557-4fb8-9fcf-ec053cd4e2a2');

-- 2. The surviving high-volume record IS the mustard flowers — rename it.
--    Category (flowers) and pricing (lg $20 / sm $10) stay; all 221 deliveries
--    of history stay attached.
UPDATE items SET name = 'Mustard Flowers'
WHERE id = '6bbd72d4-4557-4fb8-9fcf-ec053cd4e2a2';

-- 3. Promote a dead stub into the "Mustard Leaves" anchor (the greens).
--    Unpriced on purpose — surfaces in the $0 review on first delivery.
UPDATE items
SET name = 'Mustard Leaves',
    category = 'herbs_leaves',
    unit_type = 'lg,sm',
    parent_item_id = NULL
WHERE id = '8f3b3248-2309-4063-807b-117179baa41e';

SELECT pf_fold_item_v2('221ddb94-c7af-4b87-8bbd-9c38ac11c463',   -- other dead "mustard" stub
                       '8f3b3248-2309-4063-807b-117179baa41e');

-- 4. Group under the leaf anchor (mirrors Nasturtium): Mustard Leaves = parent,
--    Mustard Flowers + Mizuna = children. Both repointed in one statement so
--    the anchor never transiently holds a grandchild.
UPDATE items
SET parent_item_id = '8f3b3248-2309-4063-807b-117179baa41e'
WHERE id IN (
  '6bbd72d4-4557-4fb8-9fcf-ec053cd4e2a2',  -- Mustard Flowers
  'a13ef191-5368-45d6-90a0-ca6a6d3bff77'   -- Mizuna
);

DROP FUNCTION pf_fold_item_v2(uuid, uuid);

COMMIT;
