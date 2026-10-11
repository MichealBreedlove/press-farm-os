-- Migration 089: Figs green-bin price → $120 (15 lb × $8/lb)
--
-- DATA FIX (Micheal 2026-10-11): a green bin of figs holds ~15 lb and $8/lb
-- is the correct fig price, so the bin price goes $33.90 → $120.00 (it was
-- pricing figs at ~$2.26/lb). Only unit_prices.gb changes; lbs/lg/sm/ea and
-- past delivery_items are untouched (historical lines keep the price they
-- were logged at). Rollback: set gb back to 33.90.

UPDATE items
SET unit_prices = jsonb_set(unit_prices, '{gb}', to_jsonb(120.00::numeric), true),
    updated_at = now()
WHERE id = '1767c49c-d2d0-4f99-bd54-95b38dda9ff2';  -- Figs (fruit_veg)
