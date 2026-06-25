-- 071_order_item_substitution
-- Shortage substitution workflow: when the admin is out of an ordered item
-- (e.g. Calendula) and sends something similar instead (e.g. Miracle), the
-- substitution is recorded on the shorted order_item so the chef can be told
-- exactly what they got in its place.
--
-- The replacement is stored both as an optional FK (replacement_item_id, for
-- future analytics / linking) and a denormalized label (replacement_label, the
-- name as shown to the chef) so the substitution copy survives even if the
-- replacement item is later renamed or archived. Quantity + unit are optional
-- — admin may just note "Miracle" without committing to an exact amount.
--
-- All columns are NULL for non-substituted lines. Clearing a shortage clears
-- the replacement too (handled in the shortage API route).

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS replacement_item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replacement_label text,
  ADD COLUMN IF NOT EXISTS replacement_quantity numeric,
  ADD COLUMN IF NOT EXISTS replacement_unit text;

COMMENT ON COLUMN order_items.replacement_item_id IS
  'Substitution: catalog item sent in place of this shorted line. NULL when no substitute. ON DELETE SET NULL so deleting the item keeps the line + its replacement_label.';
COMMENT ON COLUMN order_items.replacement_label IS
  'Substitution: denormalized name of the replacement as shown to the chef (e.g. "Miracle"). Survives rename/archive of replacement_item_id.';
COMMENT ON COLUMN order_items.replacement_quantity IS
  'Substitution: optional quantity of the replacement actually sent. NULL = unspecified.';
COMMENT ON COLUMN order_items.replacement_unit IS
  'Substitution: optional unit code for replacement_quantity (e.g. "bu", "ea"). NULL = unspecified.';
