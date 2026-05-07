-- 034_receiver_received.sql
-- Adds receiver close-out fields:
--   • order_items.received_at — set when the receiver checks an
--     ordered line as "came in" on the receiver dashboard
--   • delivery_items.received_at — same, for "extra" lines that
--     arrived without a matching order_item
--   • deliveries.closed_at + closed_by_name — set when the receiver
--     closes out the day's delivery for that restaurant. closed_by_name
--     is a free-text "marked by" input the receiver fills in at
--     close-out so disputes have a person attached, not just a
--     restaurant account.
--
-- All nullable. Lines without received_at after close_at are the
-- "did not arrive" record for accountability.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

ALTER TABLE delivery_items
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by_name TEXT;

COMMENT ON COLUMN order_items.received_at IS
  'Timestamp the receiver confirmed this line came in. NULL = unconfirmed.';
COMMENT ON COLUMN delivery_items.received_at IS
  'Timestamp the receiver confirmed this line came in (used for extras delivered without an order line). NULL = unconfirmed.';
COMMENT ON COLUMN deliveries.closed_at IS
  'Timestamp the receiver closed out this delivery (signoff). NULL = still open.';
COMMENT ON COLUMN deliveries.closed_by_name IS
  'Free-text name the receiver typed at close-out — provides personal attribution on a shared restaurant account.';
