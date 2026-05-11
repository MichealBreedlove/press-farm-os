-- 040_events_restaurant.sql
-- Re-creates the Events pseudo-restaurant so the shared 'events' account
-- has somewhere to save its orders. Migration 023 removed Events as a
-- standalone restaurant and moved event items behind an item-level flag;
-- but now that there's an Events team with its own login, they need a
-- restaurant_users row pointing at SOMETHING — and the cleanest target
-- is an Events restaurant that exists purely for that purpose.
--
-- Idempotent: ON CONFLICT (slug) DO NOTHING means re-running is safe.

INSERT INTO restaurants (farm_id, name, slug)
SELECT id, 'Events', 'events' FROM farms
ORDER BY created_at ASC
LIMIT 1
ON CONFLICT (slug) DO NOTHING;
