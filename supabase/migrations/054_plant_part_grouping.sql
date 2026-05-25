-- ============================================
-- Press Farm OS — Migration 054: Fennel parts, Nasturtium capers, plant-part grouping
--
-- Per Micheal 2026-05-24:
--   A. Fennel — clean up 5 tangled records into an umbrella "Fennel"
--      parent + four part children:
--        Fennel Fronds  (lg $10 / sm $5)
--        Fennel Flowers (lg $15 / sm $7.50)
--        Fennel Stems   (price TBD — created unpriced)
--        Fennel Seed    (price TBD — created unpriced)
--      Folds the stray lowercase "fennel" and the miscategorized
--      "Fennel Flowers" (herbs_leaves) records into the right child.
--   B. Nasturtium — keep the leaf as the anchor ("Nasturtium" = leaves),
--      rename the flower to "Nasturtium Flowers", add "Nasturtium Capers"
--      (seed pods, price TBD), all grouped under the leaf.
--   C. Group already-split plant parts under their root parent:
--      Carrots (tops→root), Beets (greens→root), Turnip (leaves→root),
--      Radish (flower/pods/shoots/tiny pods→root).
--
-- New part items are created with empty unit_prices on purpose — they'll
-- surface in the $0 review query when first delivered, to be priced then.
-- ============================================

BEGIN;

-- Collision-safe fold helper (moves all FK refs dup→canonical, then deletes dup)
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

-- ============================================
-- A. FENNEL
--   6abc9c65 = umbrella parent "Fennel" (micros_leaves)
--   36544888 = "Fennel" (herbs)   → Fennel Fronds
--   b337ace7 = "fennel" lowercase → fold into Fronds
--   66372f40 = "Fennel" (flowers) → Fennel Flowers
--   d4379b2c = "Fennel Flowers" (herbs, miscat.) → fold into Fennel Flowers
-- ============================================

-- Umbrella parent: sane fronds-level pricing (was the generic micros template)
UPDATE items
SET unit_prices = '{"lg":10,"sm":5}'::jsonb, default_price = 10.00
WHERE id = '6abc9c65-6443-4df3-af69-028b779bebfc';

-- Fronds
UPDATE items
SET name = 'Fennel Fronds',
    unit_type = 'lg,sm',
    parent_item_id = '6abc9c65-6443-4df3-af69-028b779bebfc'
WHERE id = '36544888-214e-4db5-957f-4cb832496d5c';

SELECT pf_fold_item_v2('b337ace7-982b-4532-a3d9-cbc6e5245dcc',   -- lowercase "fennel"
                       '36544888-214e-4db5-957f-4cb832496d5c');  -- → Fennel Fronds

-- Flowers
UPDATE items
SET name = 'Fennel Flowers',
    unit_prices = '{"lg":15,"sm":7.5}'::jsonb,
    default_price = 15.00,
    parent_item_id = '6abc9c65-6443-4df3-af69-028b779bebfc'
WHERE id = '66372f40-d12c-4910-9a22-12950f1a875d';

SELECT pf_fold_item_v2('d4379b2c-3b02-40b1-bf18-273894819926',   -- miscat. "Fennel Flowers"
                       '66372f40-d12c-4910-9a22-12950f1a875d');  -- → Fennel Flowers

-- New parts (unpriced)
INSERT INTO items (farm_id, name, category, unit_type, parent_item_id) VALUES
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Fennel Stems','herbs_leaves','lg,sm','6abc9c65-6443-4df3-af69-028b779bebfc'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Fennel Seed','herbs_leaves','lg,sm','6abc9c65-6443-4df3-af69-028b779bebfc');

-- ============================================
-- B. NASTURTIUM
--   51465d80 = leaf (herbs)   → anchor parent, name stays "Nasturtium"
--   e4f4559b = flower         → "Nasturtium Flowers", child of leaf
--   + new "Nasturtium Capers" (seed pods), child of leaf
-- ============================================
UPDATE items
SET name = 'Nasturtium Flowers',
    parent_item_id = '51465d80-117d-44b3-b833-72e11fafd3cd'
WHERE id = 'e4f4559b-dfd1-4432-b812-51d3672ef0e5';

INSERT INTO items (farm_id, name, category, unit_type, parent_item_id) VALUES
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Nasturtium Capers','fruit_veg','lg,sm,ea','51465d80-117d-44b3-b833-72e11fafd3cd');

-- ============================================
-- C. GROUP EXISTING PLANT PARTS UNDER ROOT PARENTS
-- ============================================
-- Carrots: tops (micros) → root (fruit_veg)
UPDATE items SET parent_item_id = '4d2c4de4-0ca2-4e06-af78-4b8a80b11cc2'
  WHERE id = 'dc86a1f9-28dd-4a89-b05b-58dc629bc7ce';

-- Beets: greens (Beet micros) → root (Beets fruit_veg)
UPDATE items SET parent_item_id = '59ab48e0-a34b-4463-8519-3ab8b8cf6d0b'
  WHERE id = 'c61d163f-d5ac-474b-a38a-474c8fe9d7f9';

-- Turnip: leaves → root
UPDATE items SET parent_item_id = 'b9e401a4-b7c7-4dc6-886c-d4eb483fb90f'
  WHERE id = 'a6314da7-cab4-4c0f-b1c6-2571ef493d77';

-- Radish: flower / pods / shoots / tiny pods → root
UPDATE items SET parent_item_id = 'eedb9e62-5ad6-4044-88cf-1e11b3f6bdca'
  WHERE id IN (
    'ee95f100-9776-427f-847c-c51793507b90',  -- Radish (flowers)
    'f204dea5-2832-4d0c-a08f-5874097a6859',  -- Radish Pods
    'd31accc0-86d2-4ccf-88f6-e9d5cf91066a',  -- Radish Shoots
    '804a6141-a34f-4fb2-884e-22a1af08264e'   -- Tiny Radish Pods
  );

DROP FUNCTION pf_fold_item_v2(uuid, uuid);

COMMIT;
