-- 048_fix_nasturtium_items.sql
-- Nasturtium catalog cleanup (Micheal, 2026-05-23). All data-only — no code
-- changes ship with this. Three parts, each idempotent; one transaction.
--
-- Part 1 — Self-referencing parent.
--   The canonical "Nasturtium" (flowers) row had parent_item_id pointing at
--   itself. The items API forbids this (`Item cannot be its own parent`), so
--   it's leftover bad data from a pre-validation direct edit. On
--   /admin/items/[id] it made the item load *itself* as a subitem, which
--   hides the SubitemsPanel (it only renders when parent_item_id IS NULL) and
--   disables the Parent dropdown. Clearing it to NULL restores both.
--
-- Part 2 — Fold the duplicate FLOWER rows.
--   Two archived herbs_leaves rows — 'Nasturtium Flower' and 'Nasturtium
--   flowers' — are miscategorized copies of the flower, left from the Q1/Q2
--   backfill (migration 038). They carry 12 historical delivery_items (lg @
--   $15, sm @ $7.50) that are plainly nasturtium *flower* sales but get
--   grouped under these junk rows in revenue reports. Reassign those rows to
--   the canonical flowers "Nasturtium" (prices/quantities untouched — only
--   attribution changes), then delete the two duplicates. Verified they carry
--   no other items.id FK refs (availability, plantings, price_history, etc.).
--
-- Part 3 — Establish the LEAVES item.
--   Nasturtium leaves are a distinct product, sold by the leaf at $0.40 ea
--   (see migration 039). There is currently no live leaves row — only two
--   dead, unpriced, archived herbs_leaves stubs ('nasturtium' / 'Nasturtium',
--   zero references). Revive one as the active "Nasturtium" leaves item at
--   $0.40/ea and drop the other. (Named "Nasturtium" per Micheal; the
--   herbs_leaves category disambiguates it from the flower on the order form.)

BEGIN;

DO $blk$
DECLARE
  canonical_id uuid;  -- flowers "Nasturtium"
  flower_dups  uuid[]; -- archived herbs_leaves *flower* copies
  leaf_id      uuid;  -- the surviving herbs_leaves "Nasturtium" (leaves)
BEGIN
  -- ---- Part 1: clear any self-referencing parent (this row or any other) ----
  UPDATE items SET parent_item_id = NULL WHERE parent_item_id = id;

  -- ---- Part 2: fold the duplicate flower rows into the canonical flower ----
  SELECT id INTO canonical_id
    FROM items
   WHERE LOWER(TRIM(name)) = 'nasturtium' AND category = 'flowers'
   ORDER BY is_archived ASC NULLS LAST, created_at ASC
   LIMIT 1;

  IF canonical_id IS NOT NULL THEN
    SELECT array_agg(id) INTO flower_dups
      FROM items
     WHERE category = 'herbs_leaves'
       AND is_archived = true
       AND id <> canonical_id
       AND LOWER(name) LIKE 'nasturtium%'
       AND LOWER(name) LIKE '%flower%';

    IF flower_dups IS NOT NULL AND array_length(flower_dups, 1) > 0 THEN
      UPDATE delivery_items SET item_id = canonical_id WHERE item_id = ANY(flower_dups);
      DELETE FROM items WHERE id = ANY(flower_dups);
    END IF;
  ELSE
    RAISE NOTICE 'No canonical Nasturtium (flowers) item — skipping Part 2.';
  END IF;

  -- ---- Part 3: establish the active herbs_leaves "Nasturtium" leaves item ----
  -- Pick the survivor (prefer a non-archived one if it somehow already exists).
  SELECT id INTO leaf_id
    FROM items
   WHERE category = 'herbs_leaves'
     AND LOWER(TRIM(name)) = 'nasturtium'
   ORDER BY is_archived ASC NULLS LAST, created_at ASC
   LIMIT 1;

  IF leaf_id IS NULL THEN
    INSERT INTO items (farm_id, name, category, unit_type, default_price, unit_prices, is_archived)
    VALUES ((SELECT id FROM farms LIMIT 1), 'Nasturtium', 'herbs_leaves', 'ea',
            0.40, jsonb_build_object('ea', 0.40), false)
    RETURNING id INTO leaf_id;
  ELSE
    -- Drop any other dead leaves stubs BEFORE renaming the survivor, so the
    -- rename can't collide on UNIQUE(farm_id, name, category).
    DELETE FROM items
     WHERE category = 'herbs_leaves'
       AND id <> leaf_id
       AND LOWER(TRIM(name)) = 'nasturtium';

    UPDATE items
       SET name          = 'Nasturtium',
           is_archived   = false,
           unit_type     = 'ea',
           default_price = 0.40,
           unit_prices   = COALESCE(unit_prices, '{}'::jsonb) || jsonb_build_object('ea', 0.40)
     WHERE id = leaf_id;
  END IF;
END $blk$;

COMMIT;
