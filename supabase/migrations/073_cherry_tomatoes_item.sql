-- 073_cherry_tomatoes_item.sql
-- Adds "Cherry Tomatoes" as a distinct catalog item, separate from the existing
-- "Tomatoes" (currant tomatoes) item. Regular menu only (Press + Under-Study),
-- mirroring the Tomatoes sibling for category/units/pricing. Left unpublished
-- (no availability_items rows) per Micheal — publish when it's ready to order.

INSERT INTO items (
  farm_id, name, category, unit_type, default_price, unit_prices,
  is_event_item, is_press_bar_item, show_in_regular_menu, is_archived
)
SELECT f.id, 'Cherry Tomatoes', 'fruit_veg', 'lg,sm,gb,ea,lbs', 55,
       '{"lg":25,"sm":12.5,"gb":150,"ea":0.5,"lbs":6}'::jsonb,
       false, false, true, false
FROM farms f WHERE f.name = 'Press Farm'
ON CONFLICT (farm_id, name, category) DO UPDATE SET
  unit_type=EXCLUDED.unit_type, default_price=EXCLUDED.default_price,
  unit_prices=EXCLUDED.unit_prices, is_event_item=EXCLUDED.is_event_item,
  is_press_bar_item=EXCLUDED.is_press_bar_item,
  show_in_regular_menu=EXCLUDED.show_in_regular_menu, is_archived=false,
  updated_at=now();
