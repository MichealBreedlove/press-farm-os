-- 063_seed_puff_ball_marigold.sql
--
-- Adds "Puff Ball Marigold" to the catalog and publishes it as AVAILABLE for
-- all four restaurants (Press, Under-Study, Events, Press Bar).
--
-- Pricing mirrors the other marigolds already in the catalog
-- (French Marigold / Marigold / Pompom Marigold): $12 LG, $6 SM.
--
-- Image lives in the repo at
--   public/assets/pressfarm/items/puff-ball-marigold.jpg
-- and is referenced by relative URL. It renders once this branch is deployed.
--
-- "Available for all restaurants" is achieved two ways, both required:
--   1. Menu-placement flags on the item — show_in_regular_menu (Press +
--      Under-Study), is_event_item (Events), is_press_bar_item (Press Bar).
--   2. availability_items rows = 'available' for each restaurant on the
--      current anchor delivery date (2026-05-30). Forward dates with no
--      explicit rows inherit this via the order form's availability rollover.
--
-- Idempotent: safe to re-run.

-- 1. Catalog item ----------------------------------------------------------
INSERT INTO items (
  farm_id, name, category, unit_type, default_price, unit_prices, image_url,
  is_event_item, is_press_bar_item, show_in_regular_menu, is_archived
)
SELECT
  f.id,
  'Puff Ball Marigold',
  'flowers',
  'lg,sm',
  12,
  '{"lg": 12, "sm": 6}'::jsonb,
  '/assets/pressfarm/items/puff-ball-marigold.jpg',
  true,   -- Events
  true,   -- Press Bar
  true,   -- Press + Under-Study (Regular menu)
  false
FROM farms f
WHERE f.name = 'Press Farm'
ON CONFLICT (farm_id, name, category) DO UPDATE SET
  unit_type            = EXCLUDED.unit_type,
  default_price        = EXCLUDED.default_price,
  unit_prices          = EXCLUDED.unit_prices,
  image_url            = EXCLUDED.image_url,
  is_event_item        = EXCLUDED.is_event_item,
  is_press_bar_item    = EXCLUDED.is_press_bar_item,
  show_in_regular_menu = EXCLUDED.show_in_regular_menu,
  is_archived          = false,
  updated_at           = now();

-- 2. Publish availability = available for all four restaurants -------------
INSERT INTO availability_items (item_id, restaurant_id, delivery_date, status)
SELECT i.id, r.id, DATE '2026-05-30', 'available'
FROM items i
CROSS JOIN restaurants r
WHERE i.name = 'Puff Ball Marigold'
  AND i.category = 'flowers'
ON CONFLICT (item_id, restaurant_id, delivery_date) DO UPDATE SET
  status     = 'available',
  updated_at = now();
