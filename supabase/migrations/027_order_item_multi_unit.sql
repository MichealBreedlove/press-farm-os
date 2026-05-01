-- 027: Persist unit / size / color choices on order_items
--
-- Until now, when a chef ordered 5 Small To Go AND 3 Large To Go of the
-- same Squash Blossom (or 3 Quarter-sized red AND 2 Quarter-sized blue),
-- those choices got encoded as a string suffix on the line name + a
-- "Color: red, blue" itemNote. The quantity_requested column held the
-- *sum* and downstream:
--   - The receiver dashboard collapsed multiple sizes/colors into one row
--   - The receiver email did the same
--   - Editing an existing order couldn't restore the original selections
--
-- This migration adds three discriminator columns so each (item × unit ×
-- size × color) combination can be its own order_items row. The chef
-- order form's quantity-key strategy already accounts for this:
--   availId__unit:UNIT__SIZE  (multi-unit + sizes)
--   availId__unit:UNIT        (multi-unit only)
--   availId__SIZE             (sizes only)
--   availId                   (plain)
-- — we just persist the components instead of throwing them away on submit.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_type text,
  ADD COLUMN IF NOT EXISTS size_label text,
  ADD COLUMN IF NOT EXISTS color_key text;

COMMENT ON COLUMN order_items.unit_type IS
  'Single unit code chosen by chef (sm/lg/ea/...). Backfilled to the item''s first declared unit for legacy rows.';
COMMENT ON COLUMN order_items.size_label IS
  'Size descriptor when the item has sizes (e.g. "Quarter", "Palm"). NULL otherwise.';
COMMENT ON COLUMN order_items.color_key IS
  'Comma-separated colors chosen for this line (e.g. "red,blue"). NULL when the item has no colors.';

-- Backfill: existing order_items with NULL unit_type → set to the linked
-- item's first declared unit. items.unit_type may be a single value or a
-- comma-separated list ("sm,lg,ea") since migration 021; split_part picks
-- the first.
UPDATE order_items oi
SET unit_type = (
  SELECT split_part(i.unit_type, ',', 1)
  FROM availability_items ai
  JOIN items i ON i.id = ai.item_id
  WHERE ai.id = oi.availability_item_id
)
WHERE oi.unit_type IS NULL;

-- Composite index on the discriminators so receiver aggregation + chef
-- edit hydration can group by (item, unit, size, color) cheaply.
CREATE INDEX IF NOT EXISTS idx_order_items_composite
  ON order_items(order_id, availability_item_id, unit_type, size_label);
