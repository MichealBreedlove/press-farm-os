-- 069_order_event_date
-- Events-team ordering: an order placed by the Events team carries TWO dates —
-- the delivery_date (when items arrive, already on the table and what drives
-- availability / harvest / the orders dashboard) and the event_date (the day of
-- the event itself). Regular chef orders leave both new columns NULL.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS event_date date;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS event_name text;

COMMENT ON COLUMN orders.event_date IS
  'Events-team orders only: the date of the event itself, distinct from delivery_date. NULL for regular chef orders.';
COMMENT ON COLUMN orders.event_name IS
  'Events-team orders only: optional label for the event (e.g. "Wine club dinner"). NULL for regular chef orders.';
