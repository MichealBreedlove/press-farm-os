-- 050_delivery_item_size.sql
-- Add a size descriptor to delivery lines so the farm can log a drop-off
-- against the specific size a chef ordered (e.g. Nasturtium "Palm" vs
-- "Dollar"). Per Micheal 2026-05-23 — closes the receiver gap where one
-- sizeless delivery line couldn't reconcile against multiple ordered sizes.
--
-- Nullable + no default: existing rows (and any future line logged without a
-- size) stay NULL, and the receiver falls back to pooling them across the
-- item+unit's ordered sizes. Free text, mirroring items.size / order_items
-- .size_label — no CHECK constraint.

ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS size_label text;
