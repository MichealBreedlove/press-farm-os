-- 028: Press Bar tag on items.
--
-- Mirrors the is_event_item flag added in migration 023 — a boolean on
-- the items table that puts an item into a third menu placement on the
-- chef order form ("Press Bar Menu") alongside "Regular Menu" and
-- "Events Menu". The three placements are mutually exclusive at the
-- UI layer; the database doesn't enforce it (saves the migration cost
-- of a CHECK constraint that we'd have to drop the next time we add
-- a fourth placement).
--
-- Indexed because the chef /order page filters by this flag on every
-- page load, same as the Events index from migration 023.

ALTER TABLE items ADD COLUMN IF NOT EXISTS is_press_bar_item boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_items_press_bar ON items(is_press_bar_item);
