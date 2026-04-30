-- 023: Event items as a tag on the catalog
--
-- Previously "Events" was a third pseudo-restaurant; the chef order page merged
-- Events availability into Press + Under-Study order forms with an inline "Events"
-- badge. That made events feel like a separate thing.
--
-- New model: events are a tag on items themselves. Both Press and Under-Study can
-- offer event items via their own per-restaurant availability. The chef order form
-- groups items by `is_event_item` into a "Regular Menu" and "Events Menu" section.

-- 1. Add the flag
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_event_item boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_items_event ON items(is_event_item);

-- 2. Migrate: any item that currently has availability rows under the Events
--    restaurant gets tagged as is_event_item = true.
UPDATE items
SET is_event_item = true
WHERE id IN (
  SELECT DISTINCT ai.item_id
  FROM availability_items ai
  JOIN restaurants r ON r.id = ai.restaurant_id
  WHERE r.name ILIKE '%event%'
);

-- 3. Migrate: copy Events availability rows to every non-Events restaurant for
--    the same delivery_date so chefs see those items via their own restaurant.
--    ON CONFLICT preserves existing per-restaurant overrides — never overwrites
--    an explicit row that already exists.
INSERT INTO availability_items (
  item_id, restaurant_id, delivery_date, status, limited_qty, cycle_notes,
  available_sizes, available_colors, available_units
)
SELECT
  ai.item_id,
  r_real.id,
  ai.delivery_date,
  ai.status,
  ai.limited_qty,
  ai.cycle_notes,
  ai.available_sizes,
  ai.available_colors,
  ai.available_units
FROM availability_items ai
JOIN restaurants r_events ON r_events.id = ai.restaurant_id AND r_events.name ILIKE '%event%'
CROSS JOIN restaurants r_real
WHERE r_real.name NOT ILIKE '%event%'
ON CONFLICT (item_id, restaurant_id, delivery_date) DO NOTHING;
