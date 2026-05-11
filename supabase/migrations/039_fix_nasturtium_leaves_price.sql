-- 039_fix_nasturtium_leaves_price.sql
-- Per Micheal: Nasturtium Leaves should be priced at $0.40 per leaf (EA),
-- NOT $15 per LG. That $15 was carried over from the nasturtium-flowers
-- price by mistake — they're a different product.
--
-- This migration:
--   1. Locates (or creates) the canonical "Nasturtium Leaves" item in
--      herbs_leaves with default_price=0.40 and an EA unit option.
--   2. Sets unit_prices.ea = 0.40 so the per-unit price renders correctly
--      on the order form.
--   3. Updates any existing delivery_items rows pointing at that item
--      whose unit_price is exactly $15 — overwriting them to $0.40 so
--      the financial roll-up reflects the real per-leaf price.
--
-- Idempotent: re-running just no-ops on the updates.

BEGIN;

DO $blk$
DECLARE
  nl_id uuid;
BEGIN
  -- Match any reasonable spelling: 'Nasturtium Leaves', 'Nasturtium Leaf',
  -- or anything else that contains both 'nasturtium' and 'lea' (case-insensitive).
  SELECT id INTO nl_id FROM items
    WHERE LOWER(TRIM(name)) IN ('nasturtium leaves','nasturtium leaf')
       OR (LOWER(name) LIKE '%nasturtium%' AND LOWER(name) LIKE '%lea%')
    ORDER BY is_archived ASC NULLS LAST, created_at ASC
    LIMIT 1;

  IF nl_id IS NULL THEN
    INSERT INTO items (farm_id, name, category, unit_type, default_price, unit_prices)
    VALUES (
      (SELECT id FROM farms LIMIT 1),
      'Nasturtium Leaves',
      'herbs_leaves',
      'ea',
      0.40,
      jsonb_build_object('ea', 0.40)
    )
    RETURNING id INTO nl_id;
  ELSE
    -- Make sure 'ea' is in the unit_type list (comma-separated). Don't
    -- clobber other units — Micheal may sell leaves by the LG bag too,
    -- in which case keep that option and just fix the per-leaf price.
    UPDATE items
       SET unit_type = CASE
             WHEN unit_type IS NULL OR unit_type = '' THEN 'ea'
             WHEN ',' || unit_type || ',' LIKE '%,ea,%' THEN unit_type
             ELSE unit_type || ',ea'
           END,
           default_price = 0.40,
           unit_prices   = COALESCE(unit_prices, '{}'::jsonb) || jsonb_build_object('ea', 0.40)
     WHERE id = nl_id;
  END IF;

  -- Re-price any historical delivery_items rows that were carrying the
  -- wrong $15 price for this item. Only touches rows at exactly 15 to
  -- avoid clobbering anything Micheal already corrected by hand.
  UPDATE delivery_items
     SET unit_price = 0.40
   WHERE item_id = nl_id
     AND unit_price = 15;
END $blk$;

COMMIT;
