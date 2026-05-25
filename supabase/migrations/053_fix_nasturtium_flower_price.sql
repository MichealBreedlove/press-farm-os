-- ============================================
-- Press Farm OS — Migration 053: Fix Nasturtium Flowers price
--
-- Nasturtium Flowers carried lg $25 / sm $10, higher than Micheal's master
-- key ("Nasturtium, Flower LG $15"). Corrected to lg $15 / sm $7.50.
-- Only affects future auto-pricing — historical delivery_items keep their
-- own recorded unit_price.
-- ============================================

BEGIN;

UPDATE items
SET unit_prices = '{"lg":15,"sm":7.5}'::jsonb, default_price = 15.00
WHERE id = 'e4f4559b-dfd1-4432-b812-51d3672ef0e5';

COMMIT;
