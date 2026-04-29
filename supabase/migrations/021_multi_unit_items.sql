-- 021: Multi-unit support for items + Green Bin unit
-- An item can now be sold in multiple containers (e.g. "sm, lg" → both Small To Go and Large To Go)
-- Stored as a comma-separated string in items.unit_type (matching items.size pattern)

-- 1. Drop the single-value CHECK constraint on items.unit_type so multiple comma-separated
--    values can be stored. Validation moves to the application layer.
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_unit_type_check;

-- 2. Add Green Bin (gb) to the delivery_items unit check constraint
ALTER TABLE delivery_items DROP CONSTRAINT IF EXISTS delivery_items_unit_check;
ALTER TABLE delivery_items
  ADD CONSTRAINT delivery_items_unit_check
  CHECK (unit IN ('ea', 'sm', 'lg', 'gb', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit'));

-- 3. Per-availability unit overrides (parallel to available_sizes/available_colors)
--    NULL = all of item's units are available; otherwise comma-separated subset.
ALTER TABLE availability_items ADD COLUMN IF NOT EXISTS available_units text;
