-- 074: Add Lemon Verbena to the catalog (data-only).
-- Modeled on Lemon Balm: herbs_leaves, units lg/sm/gb/ea, same pricing,
-- visible on Regular + Events + Press Bar menus.
--
-- ALREADY APPLIED LIVE via the Supabase MCP on 2026-07-26, along with
-- availability rows on each restaurant's anchor date (transient operational
-- data, intentionally not captured here). Idempotent — safe to re-run.

INSERT INTO items (
  farm_id, name, category, unit_type, default_price, unit_prices,
  is_event_item, is_press_bar_item, show_in_regular_menu, is_archived
)
SELECT f.id, 'Lemon Verbena', 'herbs_leaves', 'lg,sm,gb,ea', 15.00,
       '{"ea":0.2,"gb":60,"lg":10,"sm":5}'::jsonb,
       true, true, true, false
FROM farms f WHERE f.name = 'Press Farm'
ON CONFLICT (farm_id, name, category) DO UPDATE SET
  unit_type = EXCLUDED.unit_type,
  default_price = EXCLUDED.default_price,
  unit_prices = EXCLUDED.unit_prices,
  is_event_item = EXCLUDED.is_event_item,
  is_press_bar_item = EXCLUDED.is_press_bar_item,
  show_in_regular_menu = EXCLUDED.show_in_regular_menu,
  is_archived = false,
  updated_at = now();
