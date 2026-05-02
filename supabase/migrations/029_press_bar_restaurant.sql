-- 029: Press Bar pseudo-restaurant.
--
-- Migration 028 added the is_press_bar_item flag on items so they slot
-- into a "Press Bar" section on the chef order form (alongside Regular
-- and Events). But the admin views (/admin/orders, /admin/availability,
-- etc.) iterate over the restaurants table to render per-restaurant
-- cards, so without a row here Press Bar doesn't appear there.
--
-- Mirrors the pattern Events follows: a pseudo-restaurant with no chef
-- assigned, present so admin can track its harvest/availability state
-- the same way as the real restaurants. Chefs (Press / Under-Study)
-- order Press Bar items via their existing logins; the items get
-- saved under the chef's own restaurant_id, never under this one.
--
-- Idempotent — ON CONFLICT (slug) DO NOTHING means re-running this
-- migration is a no-op if the row already exists.

INSERT INTO restaurants (farm_id, name, slug)
SELECT id, 'Press Bar', 'press-bar' FROM farms
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (slug) DO NOTHING;
