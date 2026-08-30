-- 079: DATA FIX — normalize uppercase unit codes on items
--
-- Eight items created 2026-06-13/14 carry unit_type = 'EA' (and a matching
-- uppercase {"EA": …} key in unit_prices) instead of the canonical lowercase
-- 'ea'. The item PATCH/POST validation is case-sensitive against
-- UNIT_TYPES, so any edit to these items failed with "Invalid unit_type",
-- and the item form's unit checkboxes never showed EA as selected.
--
-- Affected: Bells of Ireland, Celosia, Fenugreek, Kale, Marshmallow,
-- Shallots, Shasta Daisy, Sorghum.
--
-- Companion code fix lowercases unit codes in /api/items and
-- /api/items/[itemId] before validating, so mixed-case input can't 400
-- (or reintroduce uppercase rows) again.
--
-- Idempotent: both statements are no-ops once everything is lowercase.

-- Lowercase every comma-separated unit code in unit_type.
UPDATE items
SET unit_type = lower(unit_type)
WHERE unit_type <> lower(unit_type);

-- Lowercase unit_prices keys, keeping the existing value. If a lowercase
-- twin of an uppercase key already exists, the lowercase one wins.
UPDATE items
SET unit_prices = (
  -- ASCII uppercase sorts before lowercase, so ascending order aggregates
  -- the lowercase twin last and jsonb_object_agg keeps its value.
  SELECT jsonb_object_agg(lower(key), value ORDER BY key ASC)
  FROM jsonb_each(unit_prices)
)
WHERE unit_prices IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM jsonb_object_keys(unit_prices) k WHERE k <> lower(k)
  );
