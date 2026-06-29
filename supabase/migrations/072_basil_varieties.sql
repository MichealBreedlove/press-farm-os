-- 072_basil_varieties.sql
--
-- Adds four basil varieties to the catalog as children (varieties) of the
-- existing parent "Basil" item, and publishes them as AVAILABLE for all four
-- restaurants (Press, Under-Study, Events, Press Bar):
--
--   Greek Basil, Purple Ball Basil, Tulsi Basil, Genovese Basil
--
-- Each is grouped under Basil via parent_item_id (same mechanism that already
-- nests "Basil Buds" under Basil). Category, units, pricing, and menu-placement
-- flags all mirror the parent Basil item:
--   category   herbs_leaves
--   unit_type  lg,sm,gb
--   prices     {"lg": 24, "sm": 12, "gb": 144}
--   flags      show_in_regular_menu + is_event_item + is_press_bar_item (all)
--
-- "Available for all restaurants" is achieved two ways, both required:
--   1. Menu-placement flags on each item (above).
--   2. availability_items rows = 'available' for each restaurant on the current
--      anchor delivery date (2026-07-27). Forward dates with no explicit rows
--      inherit this via the order form's availability rollover.
--
-- The parent id is resolved by subquery (not hardcoded) so the migration is
-- portable. Idempotent: safe to re-run.

-- 1. Catalog items ---------------------------------------------------------
INSERT INTO items (
  farm_id, name, category, parent_item_id, unit_type, default_price, unit_prices,
  show_in_regular_menu, is_event_item, is_press_bar_item, is_archived
)
SELECT
  f.id,
  v.name,
  'herbs_leaves',
  (SELECT id FROM items
     WHERE name = 'Basil' AND category = 'herbs_leaves' AND is_archived = false),
  'lg,sm,gb',
  24,
  '{"lg": 24, "sm": 12, "gb": 144}'::jsonb,
  true,   -- Press + Under-Study (Regular menu)
  true,   -- Events
  true,   -- Press Bar
  false
FROM farms f
CROSS JOIN (VALUES
  ('Greek Basil'),
  ('Purple Ball Basil'),
  ('Tulsi Basil'),
  ('Genovese Basil')
) AS v(name)
WHERE f.name = 'Press Farm'
ON CONFLICT (farm_id, name, category) DO UPDATE SET
  parent_item_id       = EXCLUDED.parent_item_id,
  unit_type            = EXCLUDED.unit_type,
  default_price        = EXCLUDED.default_price,
  unit_prices          = EXCLUDED.unit_prices,
  show_in_regular_menu = EXCLUDED.show_in_regular_menu,
  is_event_item        = EXCLUDED.is_event_item,
  is_press_bar_item    = EXCLUDED.is_press_bar_item,
  is_archived          = false,
  updated_at           = now();

-- 2. Publish availability = available for all four restaurants -------------
INSERT INTO availability_items (item_id, restaurant_id, delivery_date, status)
SELECT i.id, r.id, DATE '2026-07-27', 'available'
FROM items i
CROSS JOIN restaurants r
WHERE i.category = 'herbs_leaves'
  AND i.name IN ('Greek Basil', 'Purple Ball Basil', 'Tulsi Basil', 'Genovese Basil')
ON CONFLICT (item_id, restaurant_id, delivery_date) DO UPDATE SET
  status     = 'available',
  updated_at = now();
