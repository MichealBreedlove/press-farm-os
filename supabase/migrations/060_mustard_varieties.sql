-- ============================================
-- Press Farm OS — Migration 060: Mustard varieties → one item + variety chips
--
-- Per Micheal 2026-05-31. Follows the variety-model decision: a crop-part is
-- ONE accounting item; cultivars are display-only "varieties" (the existing
-- per-availability `color` chip mechanism), not separate priced items. This
-- keeps reporting to one line per item instead of a SKU-per-cultivar sprawl.
--
-- Mustard greens specifically: fold Mizuna + the three Frilly Mustard records
-- into the "Mustard Leaves" anchor (created in migration 059) and seed its
-- variety list. Merges ~21 deliveries of history onto Mustard Leaves — past
-- revenue is intentionally no longer split by cultivar (Micheal: he brings a
-- mix at one price). Mustard Flowers (the flower part) stays its own item.
--
-- Historical per-line unit/price on delivery_items is preserved by the fold,
-- so finalized financials don't move; only the item-level catalog collapses.
--
-- IDs (farm 5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d):
--   8f3b3248  Mustard Leaves   herbs_leaves  anchor (price set here)
--   a13ef191  Mizuna           herbs_leaves  lg12/sm6   4 deliv → fold
--   610b5e06  Frilly Mustard   micros_leaves            16 deliv → fold
--   c5352a3c  Frilly Mustard   herbs_leaves              1 deliv → fold
--   a486b5cf  frilly mustard   herbs_leaves              0 deliv → fold (dead)
--   6bbd72d4  Mustard Flowers  flowers       child, unchanged
-- ============================================

BEGIN;

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

-- Fold the cultivars into the Mustard Leaves anchor.
SELECT pf_fold_item_v2('a13ef191-5368-45d6-90a0-ca6a6d3bff77','8f3b3248-2309-4063-807b-117179baa41e'); -- Mizuna
SELECT pf_fold_item_v2('610b5e06-bd7e-4548-bf61-46523ae7f636','8f3b3248-2309-4063-807b-117179baa41e'); -- Frilly Mustard (micros)
SELECT pf_fold_item_v2('c5352a3c-8b29-4508-9de0-f93ed158d1e9','8f3b3248-2309-4063-807b-117179baa41e'); -- Frilly Mustard (herbs)
SELECT pf_fold_item_v2('a486b5cf-5a4f-4174-a49c-0beb0b670b50','8f3b3248-2309-4063-807b-117179baa41e'); -- frilly mustard (dead)

-- Price the anchor (standard mustard-greens bunch) and seed the variety list.
-- `color` is the per-item source list the availability editor toggles into
-- weekly variety chips; ", "-separated to match the editor's parser.
UPDATE items
SET unit_type = 'lg,sm',
    unit_prices = '{"lg":12,"sm":6}'::jsonb,
    default_price = 12.00,
    color = 'Mizuna, Wasabina, Frilly'
WHERE id = '8f3b3248-2309-4063-807b-117179baa41e';

DROP FUNCTION pf_fold_item_v2(uuid, uuid);

COMMIT;
