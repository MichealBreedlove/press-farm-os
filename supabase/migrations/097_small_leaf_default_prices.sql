-- 097: Small-leaf default prices (2026-11-09)
--
-- Moonshadow, Red Frills Mustard, Golden Frills Mustard and Wasabina carried
-- unit_prices {lg: 20, sm: 10} but NO default_price, so the catalog list showed
-- no price and anything falling through to the default tier priced at $0.
-- Micheal: match all the small leaves to the same pricing → default $20 (= LG),
-- same as both Kale Mix rows.
--
-- DATA-ONLY. Applied live 2026-11-09 via the Supabase MCP. The same session
-- also set the micros_leaves Kale Mix (tray-grown; the herbs_leaves row is the
-- field kale and stays as-is) to `available` for Press + Under-Study on every
-- 2026-11-09+ date with rows — transient availability, not reproduced here.
UPDATE items SET default_price = 20, updated_at = now()
WHERE default_price IS NULL
  AND id IN (
    '0a2eaec1-b9cf-4c22-a6d0-791e1116e470',  -- Moonshadow
    'baac3f42-c2c9-46d2-8694-63ce57c577da',  -- Red Frills Mustard
    '3086f903-cb31-44bd-a8f3-9eded0177cd7',  -- Golden Frills Mustard
    '5f503898-c493-4d8a-a7ed-e716a6072283'   -- Wasabina
  );

-- Rollback:
-- UPDATE items SET default_price = NULL WHERE id IN ('0a2eaec1-b9cf-4c22-a6d0-791e1116e470','baac3f42-c2c9-46d2-8694-63ce57c577da','3086f903-cb31-44bd-a8f3-9eded0177cd7','5f503898-c493-4d8a-a7ed-e716a6072283');
