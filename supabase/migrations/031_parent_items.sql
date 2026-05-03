-- 031_parent_items.sql
-- Adds optional parent/child relationship to items so a parent crop
-- (e.g. "Squash") can group its parts (Blossoms, Tendrils, Leaves, Fruit)
-- across categories. Single-level only — children cannot themselves have
-- children. Enforced in app code: the API rejects setting parent_item_id
-- on an item that has children, and rejects setting parent_item_id to an
-- item that is itself a child.
--
-- ON DELETE SET NULL so deleting a parent doesn't cascade — children
-- continue to exist as standalone items, just unparented.
--
-- This is admin-only organization. The chef order form is unchanged:
-- children render as independent items in their own categories.

ALTER TABLE items
  ADD COLUMN parent_item_id UUID REFERENCES items(id) ON DELETE SET NULL;

CREATE INDEX idx_items_parent_item_id
  ON items(parent_item_id)
  WHERE parent_item_id IS NOT NULL;

COMMENT ON COLUMN items.parent_item_id IS
  'Optional pointer to a parent item. Groups sub-parts of a single crop (e.g. Squash → Blossoms/Tendrils/Leaves/Fruit). Single-level only — children cannot themselves have children. Admin organization only; chef order form treats children as independent items.';
