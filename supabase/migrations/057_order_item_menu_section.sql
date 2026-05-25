-- 057: Track which menu section an order line came from
--
-- An item can be flagged for multiple menus at once (migration 030's
-- show_in_regular_menu + 023's is_event_item). When a chef orders the same
-- item under BOTH the Regular Menu and the Events Menu, those are two
-- distinct intents — "200 Nasturtium for the regular line + 200 more for an
-- event that night" — and must be two separate order_items rows.
--
-- Until now every line keyed off (availability_item_id, unit_type,
-- size_label, color_key) with no menu discriminator, so the two collapsed
-- into one shared quantity in the order form and one row on submit. This
-- column is that discriminator.
--
-- Values: 'events' for lines placed in the Events Menu section. NULL for
-- everything else (Regular Menu, Press Bar) — Press Bar items are only ever
-- ordered by the Press-Bar login and never collide with Regular/Events, so
-- they don't need their own marker. Legacy rows stay NULL = Regular, no
-- backfill required.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS menu_section text;

COMMENT ON COLUMN order_items.menu_section IS
  'Which order-form section this line came from. ''events'' = Events Menu; NULL = Regular Menu / Press Bar. Lets the same item be ordered separately under Regular and Events.';

-- Backfill the unambiguous case: lines for items that can ONLY appear on the
-- Events Menu (is_event_item AND not shown in the regular menu). The order
-- form now renders those under a prefixed quantity key, so without this an
-- edit of a pre-existing events-only order would hydrate the quantity onto
-- the wrong key and show 0. Items flagged for BOTH menus stay NULL — legacy
-- rows didn't record which section they came from, so treat them as Regular
-- (matches where the form now hydrates a bare-key quantity).
UPDATE order_items oi
SET menu_section = 'events'
FROM availability_items ai
JOIN items i ON i.id = ai.item_id
WHERE ai.id = oi.availability_item_id
  AND oi.menu_section IS NULL
  AND i.is_event_item = true
  AND COALESCE(i.show_in_regular_menu, true) = false;
