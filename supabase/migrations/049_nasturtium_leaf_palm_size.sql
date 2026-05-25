-- 049_nasturtium_leaf_palm_size.sql
-- Add "Palm" as a size option on the Nasturtium leaves item (herbs_leaves),
-- per Micheal 2026-05-23. Data-only — no code change ships with this; the
-- chef order form already reads items.size (comma+space separated free text,
-- migration 016) and renders a size picker when it's non-empty.
--
-- Pricing is unchanged: the leaf stays flat $0.40/ea regardless of size. Sizes
-- carry no per-size price in the per-unit pricing model — "Palm" is purely a
-- descriptor the chef selects.
--
-- Depends on the leaf row established in migration 048; if 048 hasn't run yet
-- this no-ops with a NOTICE rather than erroring. Idempotent — re-running
-- won't duplicate "Palm".

BEGIN;

DO $blk$
DECLARE
  leaf_id uuid;
BEGIN
  -- Same selection as 048 Part 3: the active herbs_leaves "Nasturtium".
  SELECT id INTO leaf_id
    FROM items
   WHERE category = 'herbs_leaves'
     AND LOWER(TRIM(name)) = 'nasturtium'
   ORDER BY is_archived ASC NULLS LAST, created_at ASC
   LIMIT 1;

  IF leaf_id IS NULL THEN
    RAISE NOTICE 'No Nasturtium (herbs_leaves) item — run migration 048 first. Skipping.';
  ELSE
    UPDATE items
       SET size = CASE
                    WHEN size IS NULL OR btrim(size) = '' THEN 'Palm'
                    ELSE size || ', Palm'
                  END
     WHERE id = leaf_id
       -- Skip if "Palm" is already one of the comma-separated size tokens.
       AND COALESCE(size, '') !~* '(^|,[[:space:]]*)palm([[:space:]]*,|$)';
  END IF;
END $blk$;

COMMIT;
