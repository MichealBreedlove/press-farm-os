-- ============================================
-- Press Farm OS — Migration 061: cultivar clusters → one item + varieties
--
-- Per Micheal 2026-05-31. Extends the mustard variety model (059/060) to the
-- other cultivar clusters surfaced by the catalog audit. Rule: a crop-part is
-- ONE accounting item; same-part cultivars become display-only varieties (the
-- items.color chip list), NOT separate priced items.
--
-- Folds (history merges onto the anchor; cultivar split is dropped):
--   A. MINT — fold 9 cultivars into "Mint", seed variety list. One price
--      (lg $15 / sm $6, the common value; Spearmint was $10, Chocolate $12).
--   B. MARIGOLD — fold French / Pompom / Puff Ball ornamentals into "Marigold".
--      Gem Marigold stays its own item (different plant, $24, own leaf).
--   C. KALE — fold Ethiopian Kale + Kalettes into "Kale". Sea Kale &
--      Ornamental Kale stay separate (different plant / use).
--   D. DIANTHUS — fold "Dianthus Sweet Black Cherry" into "Dianthus".
--   E. SORREL — fold Red Veined + Burgundy leaf variants into "Sorrel".
--      (French Sorrel Stems stays separate — it's the stem, not the leaf.)
--
-- Variety-list seeding (no fold, no history change) on crops grown in multiple
-- types but with no separate items: Basil, Lettuce. (Tomatoes & Peppers
-- already carry a populated list — left untouched.)
--
-- Anchors keep their existing price/category; only history is merged and the
-- color (variety) list is set.
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

-- ── A. MINT (anchor 07be57a7) ─────────────────────────────────────────
SELECT pf_fold_item_v2('79ea5869-7204-49fa-8c79-32e3ad354a8e','07be57a7-3c3c-4b4c-8af1-cf5a6b028449'); -- Chocolate Mint
SELECT pf_fold_item_v2('a5d35f05-fd30-4464-80b1-db3f00ca4cda','07be57a7-3c3c-4b4c-8af1-cf5a6b028449'); -- Japanese Mint
SELECT pf_fold_item_v2('ed955af4-a70c-458f-870a-8eb82248f816','07be57a7-3c3c-4b4c-8af1-cf5a6b028449'); -- Mojito Mint
SELECT pf_fold_item_v2('66546b5d-5a61-4797-97d3-5089561be252','07be57a7-3c3c-4b4c-8af1-cf5a6b028449'); -- Moroccan Mint
SELECT pf_fold_item_v2('ece2d96e-574a-4354-88be-6ef1de626f91','07be57a7-3c3c-4b4c-8af1-cf5a6b028449'); -- Orange Mint
SELECT pf_fold_item_v2('138b7abf-a77f-4b53-8b4f-a3f2614b0a8f','07be57a7-3c3c-4b4c-8af1-cf5a6b028449'); -- Pineapple Mint (herbs)
SELECT pf_fold_item_v2('9a696890-0eac-4cee-bcde-b9b9ba731bca','07be57a7-3c3c-4b4c-8af1-cf5a6b028449'); -- Pineapple Mint (family_meal dup)
SELECT pf_fold_item_v2('9817dd3e-3427-481c-a32b-c2185a84a3f0','07be57a7-3c3c-4b4c-8af1-cf5a6b028449'); -- Spearmint
SELECT pf_fold_item_v2('1eaf2f06-91a9-48f1-8239-54497787f8dc','07be57a7-3c3c-4b4c-8af1-cf5a6b028449'); -- Strawberry Mint
UPDATE items
SET color = 'Spearmint, Peppermint, Chocolate, Mojito, Moroccan, Orange, Pineapple, Strawberry, Japanese'
WHERE id = '07be57a7-3c3c-4b4c-8af1-cf5a6b028449';

-- ── B. MARIGOLD (anchor 85e6a4f5) ─────────────────────────────────────
SELECT pf_fold_item_v2('f8a971a7-c870-48ee-bad3-6d2f20a3286e','85e6a4f5-edcd-4b0d-be47-3d5a1b785bc8'); -- French Marigold
SELECT pf_fold_item_v2('0cc9cea4-fce5-4c78-b3b9-4b7046bf15ac','85e6a4f5-edcd-4b0d-be47-3d5a1b785bc8'); -- Pompom Marigold
SELECT pf_fold_item_v2('d5e73761-6a0f-418c-9fd6-3a0c6f5ef3e9','85e6a4f5-edcd-4b0d-be47-3d5a1b785bc8'); -- Puff Ball Marigold
UPDATE items
SET color = 'French, Pompom, Puff Ball, Orange, Yellow'
WHERE id = '85e6a4f5-edcd-4b0d-be47-3d5a1b785bc8';

-- ── C. KALE (anchor 99542fc9) ─────────────────────────────────────────
SELECT pf_fold_item_v2('6d32f815-4945-4232-84e6-bda49cea685e','99542fc9-02de-457b-88a7-030d2739f3ff'); -- Ethiopian Kale
SELECT pf_fold_item_v2('2d807b86-282c-4e83-a803-b2fa5a267755','99542fc9-02de-457b-88a7-030d2739f3ff'); -- Kalettes
UPDATE items
SET color = 'Mixed, Red, Lacinato, Ethiopian, Kalettes'
WHERE id = '99542fc9-02de-457b-88a7-030d2739f3ff';

-- ── D. DIANTHUS (anchor d5289491) ─────────────────────────────────────
SELECT pf_fold_item_v2('e339449f-0668-4d93-965c-3723116cfbf7','d5289491-9851-406d-ac52-db32e61bb463'); -- Sweet Black Cherry
UPDATE items
SET color = 'Pink, Red, White, Sweet Black Cherry'
WHERE id = 'd5289491-9851-406d-ac52-db32e61bb463';

-- ── E. SORREL (anchor a49d0d7c) ───────────────────────────────────────
SELECT pf_fold_item_v2('2950744e-b2fc-46b5-92e9-e31448d870a5','a49d0d7c-5143-4558-9da9-8bd3c8f95b95'); -- Red Veined Sorrel Leaves
SELECT pf_fold_item_v2('77d01c9e-31de-43e8-bbf1-c85c67fcd5ea','a49d0d7c-5143-4558-9da9-8bd3c8f95b95'); -- Sorrels - Burgundy
UPDATE items
SET color = 'Purple, Yellow, Red Veined, Burgundy'
WHERE id = 'a49d0d7c-5143-4558-9da9-8bd3c8f95b95';

-- ── Variety-list seeding (no fold) ────────────────────────────────────
UPDATE items SET color = 'Genovese, Thai, Lemon, Purple'
  WHERE id = '820030fb-1c45-4f34-b62f-8861a45e0986';  -- Basil
UPDATE items SET color = 'Little Gem, Butter, Oak Leaf, Red Leaf, Romaine'
  WHERE id = '01492b61-43c2-4a35-bcb1-8c6e186237c6';  -- Lettuce

DROP FUNCTION pf_fold_item_v2(uuid, uuid);

COMMIT;
