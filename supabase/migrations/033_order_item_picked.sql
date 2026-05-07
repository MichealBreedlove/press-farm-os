-- 033_order_item_picked.sql
-- Adds picked_at to order_items so the per-restaurant pick list can
-- track which lines have been harvested. Set by the admin pick-list
-- checkbox; cleared by clicking it again. Kept on the row after
-- fulfillment as an audit trail (no auto-clear on status change).

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ;

COMMENT ON COLUMN order_items.picked_at IS
  'Timestamp the item was marked picked during harvest. NULL = not yet picked. Set/cleared by the admin pick-list UI.';
