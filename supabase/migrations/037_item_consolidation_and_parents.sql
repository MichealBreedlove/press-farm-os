-- 037_item_consolidation_and_parents.sql
-- Manual data cleanup based on Micheal's audit (2026-05-11):
--
--   Part A — Consolidate duplicate items: fold each dup into its canonical
--            entry, reassigning availability_items / delivery_items /
--            plantings / parent_item_id refs along the way.
--   Part B — Parent/child link cleanup: designate parents, link new
--            children, fix mis-parented items, strip stale variety entries
--            for items that now have their own row.
--
-- Each block is idempotent: it no-ops if either side has already been
-- merged manually, the names don't match, or the parent isn't there.
-- Wrapped in a single transaction so a mid-migration error doesn't leave
-- the catalog half-updated.

BEGIN;

-- =====================================================================
-- Helper: pf_consolidate_item(dup_id, canonical_id)
-- Reassigns FK references from dup -> canonical, then deletes dup.
-- Handles the availability_items UNIQUE(item_id, restaurant_id,
-- delivery_date) collision by first moving order_items to the canonical
-- avail row, then dropping the colliding dup avail row.
-- =====================================================================
CREATE OR REPLACE FUNCTION pf_consolidate_item(p_dup uuid, p_canonical uuid)
RETURNS void AS $fn$
BEGIN
  IF p_dup IS NULL OR p_canonical IS NULL OR p_dup = p_canonical THEN
    RETURN;
  END IF;

  -- 1. For colliding (restaurant_id, delivery_date) pairs, move
  --    order_items to the canonical avail row FIRST so the cascade
  --    delete of the dup avail row doesn't strand them.
  WITH collisions AS (
    SELECT d.id AS dup_avail_id, c.id AS canon_avail_id
    FROM availability_items d
    JOIN availability_items c
      ON c.item_id = p_canonical
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
      SELECT restaurant_id, delivery_date
      FROM availability_items
      WHERE item_id = p_canonical
    );

  -- 2. Move remaining (non-colliding) avail rows over.
  UPDATE availability_items SET item_id = p_canonical WHERE item_id = p_dup;

  -- 3. delivery_items + plantings: flat reassignment.
  UPDATE delivery_items SET item_id = p_canonical WHERE item_id = p_dup;
  UPDATE plantings      SET item_id = p_canonical WHERE item_id = p_dup;

  -- 4. Reparent any children of the dup to the canonical.
  UPDATE items SET parent_item_id = p_canonical WHERE parent_item_id = p_dup;

  -- 5. Drop the dup row.
  DELETE FROM items WHERE id = p_dup;
END;
$fn$ LANGUAGE plpgsql;

-- =====================================================================
-- Part A — Consolidate duplicates
-- =====================================================================

-- Passion Fruit -> Passionfruit (both fruit_veg)
SELECT pf_consolidate_item(
  (SELECT id FROM items WHERE name = 'Passion Fruit' AND category = 'fruit_veg' LIMIT 1),
  (SELECT id FROM items WHERE name = 'Passionfruit'  AND category = 'fruit_veg' LIMIT 1)
);

-- Tri-Point Leek -> Three Cornered Leek (Allium triquetrum; category-agnostic)
SELECT pf_consolidate_item(
  (SELECT id FROM items WHERE name = 'Tri-Point Leek'      LIMIT 1),
  (SELECT id FROM items WHERE name = 'Three Cornered Leek' LIMIT 1)
);

-- Oxalis (no variety) -> Oxalis Flowers (canonical, has variety) — both flowers
SELECT pf_consolidate_item(
  (SELECT id FROM items WHERE name = 'Oxalis'         AND category = 'flowers' LIMIT 1),
  (SELECT id FROM items WHERE name = 'Oxalis Flowers' AND category = 'flowers' LIMIT 1)
);

-- Chard Leaf -> Swiss Chard (both herbs_leaves, same variety list)
SELECT pf_consolidate_item(
  (SELECT id FROM items WHERE name = 'Chard Leaf'  AND category = 'herbs_leaves' LIMIT 1),
  (SELECT id FROM items WHERE name = 'Swiss Chard' AND category = 'herbs_leaves' LIMIT 1)
);

-- Lovage. (typo with trailing period, herbs_leaves) -> Lovage
-- Two paths: rename if no plain "Lovage" yet; otherwise consolidate.
UPDATE items SET name = 'Lovage'
WHERE name = 'Lovage.' AND category = 'herbs_leaves'
  AND NOT EXISTS (
    SELECT 1 FROM items WHERE name = 'Lovage' AND category = 'herbs_leaves'
  );
SELECT pf_consolidate_item(
  (SELECT id FROM items WHERE name = 'Lovage.' AND category = 'herbs_leaves' LIMIT 1),
  (SELECT id FROM items WHERE name = 'Lovage'  AND category = 'herbs_leaves' LIMIT 1)
);
-- Make the micros Lovage a child of the herbs Lovage parent.
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Lovage' AND category = 'herbs_leaves' LIMIT 1
)
WHERE name = 'Lovage' AND category = 'micros_leaves'
  AND parent_item_id IS DISTINCT FROM (
    SELECT id FROM items WHERE name = 'Lovage' AND category = 'herbs_leaves' LIMIT 1
  );

-- Pea Tendrils (herbs, variety Field) -> Field Pea Tendrils (also herbs).
-- Keeps the micros Pea Tendrils (variety Calvin) standalone — only one
-- in micros, no consolidation needed there.
SELECT pf_consolidate_item(
  (SELECT id FROM items WHERE name = 'Pea Tendrils'       AND category = 'herbs_leaves' LIMIT 1),
  (SELECT id FROM items WHERE name = 'Field Pea Tendrils' AND category = 'herbs_leaves' LIMIT 1)
);

-- Cilantro disambiguation: rename so the herbs leaf and the micros stage
-- don't both render as plain "Cilantro" on the order form.
UPDATE items SET name = 'Cilantro Leaf'
WHERE name = 'Cilantro' AND category = 'herbs_leaves'
  AND NOT EXISTS (SELECT 1 FROM items WHERE name = 'Cilantro Leaf' AND category = 'herbs_leaves');

UPDATE items SET name = 'Cilantro Micro'
WHERE name = 'Cilantro' AND category = 'micros_leaves'
  AND NOT EXISTS (SELECT 1 FROM items WHERE name = 'Cilantro Micro' AND category = 'micros_leaves');

-- Frilly Mustard standardization: keep singular spelling. If the singular
-- already exists in herbs_leaves, fold the plural in; otherwise rename.
SELECT pf_consolidate_item(
  (SELECT id FROM items WHERE name = 'Frilly Mustards' AND category = 'herbs_leaves' LIMIT 1),
  (SELECT id FROM items WHERE name = 'Frilly Mustard'  AND category = 'herbs_leaves' LIMIT 1)
);
UPDATE items SET name = 'Frilly Mustard'
WHERE name = 'Frilly Mustards' AND category = 'herbs_leaves'
  AND NOT EXISTS (SELECT 1 FROM items WHERE name = 'Frilly Mustard' AND category = 'herbs_leaves');

-- Society Garlic: keep its standalone flowers entry, strip it from the
-- Allium Flower variety list (it has its own row, so listing it as a
-- variety is misleading and shows it twice).
UPDATE items
SET variety = NULLIF(
  TRIM(BOTH ', ' FROM regexp_replace(
    regexp_replace(COALESCE(variety,''), '(^|,)\s*Society Garlic\s*', '\1', 'gi'),
    ',{2,}', ',', 'g'
  )),
  ''
)
WHERE name = 'Allium Flower' AND category = 'flowers';

-- =====================================================================
-- Part B — Parent / child link cleanup
-- =====================================================================

-- ---- Mint (create herbs_leaves parent if missing) ----
DO $blk$
DECLARE mint_id uuid;
BEGIN
  SELECT id INTO mint_id FROM items
   WHERE name = 'Mint' AND category = 'herbs_leaves' LIMIT 1;
  IF mint_id IS NULL THEN
    INSERT INTO items (farm_id, name, category, unit_type)
    VALUES ((SELECT id FROM farms LIMIT 1), 'Mint', 'herbs_leaves', 'sm')
    RETURNING id INTO mint_id;
  END IF;
  UPDATE items SET parent_item_id = mint_id
   WHERE category = 'herbs_leaves'
     AND parent_item_id IS NULL
     AND name IN ('Chocolate Mint','Japanese Mint','Mojito Mint','Moroccan Mint',
                  'Orange Mint','Pineapple Mint','Spearmint','Strawberry Mint');
END $blk$;

-- ---- Basil -> Tulsi (Basil Buds already linked) ----
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Basil' AND category = 'herbs_leaves' LIMIT 1
)
WHERE name = 'Tulsi' AND category = 'herbs_leaves' AND parent_item_id IS NULL;

-- ---- Citrus links + un-parent Nectarines (stone fruit, not citrus) ----
DO $blk$
DECLARE citrus_id uuid;
BEGIN
  SELECT id INTO citrus_id FROM items
   WHERE name = 'Citrus' AND category = 'herbs_leaves' LIMIT 1;
  IF citrus_id IS NOT NULL THEN
    UPDATE items SET parent_item_id = citrus_id
     WHERE parent_item_id IS DISTINCT FROM citrus_id
       AND (
         (category = 'fruit_veg'    AND name IN ('Lemons','Limes','Grapefruit','Mandarins','Mandarinquat','Kumquats','Calamansi Fruit','Yuzu'))
         OR (category = 'herbs_leaves' AND name IN ('Citrus Leaf','Calamansi','Kumquat Branches'))
         OR (category = 'micros_leaves' AND name = 'Citrus Leaf Shoots')
       );
    UPDATE items SET parent_item_id = NULL
     WHERE name = 'Nectarines' AND parent_item_id = citrus_id;
  END IF;
END $blk$;

-- ---- Borage parent (create herbs_leaves entry if missing) ----
DO $blk$
DECLARE borage_id uuid;
BEGIN
  SELECT id INTO borage_id FROM items
   WHERE name = 'Borage' AND category = 'herbs_leaves' LIMIT 1;
  IF borage_id IS NULL THEN
    INSERT INTO items (farm_id, name, category, unit_type)
    VALUES ((SELECT id FROM farms LIMIT 1), 'Borage', 'herbs_leaves', 'sm')
    RETURNING id INTO borage_id;
  END IF;
  UPDATE items SET parent_item_id = borage_id
   WHERE parent_item_id IS NULL
     AND ((name = 'Borage'         AND category = 'micros_leaves')
       OR (name = 'Borage Flowers' AND category = 'flowers'));
END $blk$;

-- ---- Marigold -> Gem Marigold (flowers) + Gem Marigold Leaf (micros) ----
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Marigold' AND category = 'flowers' LIMIT 1
)
WHERE parent_item_id IS NULL
  AND ((name = 'Gem Marigold'      AND category = 'flowers')
    OR (name = 'Gem Marigold Leaf' AND category = 'micros_leaves'));

-- ---- Onion -> Torpedo Onions, Onions (micros), Onion Blossoms ----
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Onion' AND category = 'fruit_veg' LIMIT 1
)
WHERE parent_item_id IS NULL
  AND ((name = 'Torpedo Onions' AND category = 'fruit_veg')
    OR (name = 'Onions'         AND category = 'micros_leaves')
    OR (name = 'Onion Blossoms' AND category = 'flowers'));

-- ---- Chamomile (herbs) Leaf -> Chamomile (herbs) ----
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Chamomile' AND category = 'herbs_leaves' LIMIT 1
)
WHERE name = 'Chamomile Leaf' AND category = 'herbs_leaves' AND parent_item_id IS NULL;

-- ---- Bok Choy -> Tatsoi, Choy Raab, Choy ----
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Bok Choy' AND category = 'fruit_veg' LIMIT 1
)
WHERE category = 'herbs_leaves'
  AND parent_item_id IS NULL
  AND name IN ('Tatsoi','Choy Raab','Choy');

-- ---- Arugula -> Wasabi Arugula ----
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Arugula' AND category = 'herbs_leaves' LIMIT 1
)
WHERE name = 'Wasabi Arugula' AND category = 'herbs_leaves' AND parent_item_id IS NULL;

-- ---- Rose Geranium parent (use the herbs entry as canonical parent) ----
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Rose Geranium' AND category = 'herbs_leaves' LIMIT 1
)
WHERE name = 'Rose Geranium' AND category = 'flowers' AND parent_item_id IS NULL;

-- ---- Hairy Vetch (flowers) -> Vetch Tendril (micros) ----
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Hairy Vetch' AND category = 'flowers' LIMIT 1
)
WHERE name = 'Vetch Tendril' AND category = 'micros_leaves' AND parent_item_id IS NULL;

-- ---- Persimmon: split into fruit_veg parent + Persimmon Leaf (herbs) child.
--      The current herbs_leaves entry covers fruit-only varieties (Fuyu /
--      Hachiya), so create a fruit_veg parent that inherits the variety
--      list, then rename the herbs row to "Persimmon Leaf" and link it.
DO $blk$
DECLARE
  herbs_id     uuid;
  fruit_id     uuid;
BEGIN
  SELECT id INTO herbs_id FROM items WHERE name = 'Persimmon' AND category = 'herbs_leaves' LIMIT 1;
  SELECT id INTO fruit_id FROM items WHERE name = 'Persimmon' AND category = 'fruit_veg'    LIMIT 1;
  IF fruit_id IS NULL AND herbs_id IS NOT NULL THEN
    INSERT INTO items (farm_id, name, category, unit_type, variety)
    SELECT farm_id, 'Persimmon', 'fruit_veg', 'ea', variety
      FROM items WHERE id = herbs_id
    RETURNING id INTO fruit_id;
  END IF;
  IF herbs_id IS NOT NULL AND fruit_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM items WHERE name = 'Persimmon Leaf' AND category = 'herbs_leaves'
     )
  THEN
    UPDATE items SET name = 'Persimmon Leaf', parent_item_id = fruit_id
     WHERE id = herbs_id;
  END IF;
END $blk$;

-- ---- Mulberries (fruit_veg) -> Mulberry Leaf (herbs).
--      Note: Mulberry Leaf's variety field currently has Mizuna varieties,
--      which is a separate data error — Micheal will fix that one by hand.
UPDATE items SET parent_item_id = (
  SELECT id FROM items WHERE name = 'Mulberries' AND category = 'fruit_veg' LIMIT 1
)
WHERE name = 'Mulberry Leaf' AND category = 'herbs_leaves' AND parent_item_id IS NULL;

-- =====================================================================
-- Drop the helper so it doesn't linger in the schema
-- =====================================================================
DROP FUNCTION pf_consolidate_item(uuid, uuid);

COMMIT;
