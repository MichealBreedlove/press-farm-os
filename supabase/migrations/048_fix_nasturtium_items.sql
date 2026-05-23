-- 048_fix_nasturtium_items.sql
-- Cleanup for the nasturtium catalog entries (Micheal, 2026-05-23).
--
-- Two problems, both data-only (no code changes ship with this):
--
--   1. Self-referencing parent. The canonical "Nasturtium" (flowers) row
--      had parent_item_id pointing at itself. The items API forbids this
--      (`Item cannot be its own parent`), so it's leftover bad data from a
--      pre-validation direct edit. The effect on /admin/items/[id] is that
--      the item loads *itself* as a subitem, which hides the SubitemsPanel
--      (it only renders when parent_item_id IS NULL) and disables the
--      Parent dropdown. Clearing it to NULL restores both.
--
--   2. Four archived duplicate rows in herbs_leaves — 'nasturtium',
--      'Nasturtium', 'Nasturtium Flower', 'Nasturtium flowers' — left over
--      from the Q1/Q2 backfill (migration 038). Two of them carry 12
--      historical delivery_items (lg @ $15, sm @ $7.50) that are plainly
--      nasturtium *flower* sales but got attributed to these junk rows, so
--      revenue reports group them under archived entries instead of the
--      real flower item. Reassign those delivery rows to the canonical
--      flowers "Nasturtium", then delete the duplicates.
--
--      None of the four duplicates carry availability_items, plantings,
--      price_history, event_requests, microgreen_crops, seeds, or child
--      items — only the 12 delivery_items — so the reassignment + delete
--      is clean. (Verified against every items.id FK before writing this.)
--
-- This does NOT touch nasturtium leaves: no 'Nasturtium Leaves' item
-- exists, and the duplicates being folded in are all the flower, priced
-- like the flower. Leaves remain a separate concern (see migration 039).
--
-- Idempotent: re-running no-ops once the canonical row is clean and the
-- duplicates are gone. Wrapped in a transaction.

BEGIN;

DO $blk$
DECLARE
  canonical_id uuid;
  dup_ids      uuid[];
BEGIN
  -- Canonical nasturtium flower. Resolve by name+category, prefer the
  -- non-archived row, to avoid hardcoding a UUID.
  SELECT id INTO canonical_id
    FROM items
   WHERE LOWER(TRIM(name)) = 'nasturtium' AND category = 'flowers'
   ORDER BY is_archived ASC NULLS LAST, created_at ASC
   LIMIT 1;

  IF canonical_id IS NULL THEN
    RAISE NOTICE 'No canonical Nasturtium (flowers) item found — skipping consolidation.';
    RETURN;
  END IF;

  -- 1. Clear any self-referencing parent (this row, or any other).
  UPDATE items SET parent_item_id = NULL
   WHERE parent_item_id = id;

  -- 2. Collect the archived herbs_leaves nasturtium-flower duplicates.
  --    Match the flower spellings only; explicitly exclude any leaf entry
  --    so a future 'Nasturtium Leaves' row could never be swept up here.
  SELECT array_agg(id) INTO dup_ids
    FROM items
   WHERE category = 'herbs_leaves'
     AND is_archived = true
     AND id <> canonical_id
     AND LOWER(name) LIKE 'nasturtium%'
     AND LOWER(name) NOT LIKE '%lea%';

  IF dup_ids IS NULL OR array_length(dup_ids, 1) = 0 THEN
    RAISE NOTICE 'No archived nasturtium duplicates to consolidate.';
    RETURN;
  END IF;

  -- 3. Reassign the stranded delivery rows to the canonical flower item.
  --    unit / unit_price / quantity are preserved exactly — this only
  --    changes which item the historical sale is attributed to.
  UPDATE delivery_items SET item_id = canonical_id
   WHERE item_id = ANY(dup_ids);

  -- 4. Drop the duplicate rows.
  DELETE FROM items WHERE id = ANY(dup_ids);
END $blk$;

COMMIT;
