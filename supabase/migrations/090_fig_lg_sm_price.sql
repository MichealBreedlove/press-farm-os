-- Migration 090: Figs LG → $20, SM → $8 ($8/lb)
--
-- DATA FIX (Micheal 2026-10-11), companion to 089: an LG of figs is 2.5 lb
-- and an SM is 1 lb, at the correct $8/lb. Was LG $5.65 / SM $2.83 (~$2.26/lb,
-- same stale ratio as the old bin price). gb/lbs/ea and past delivery_items
-- untouched. Rollback: lg 5.65, sm 2.83.

UPDATE items
SET unit_prices = unit_prices || '{"lg": 20.00, "sm": 8.00}'::jsonb,
    updated_at = now()
WHERE id = '1767c49c-d2d0-4f99-bd54-95b38dda9ff2';  -- Figs (fruit_veg)
