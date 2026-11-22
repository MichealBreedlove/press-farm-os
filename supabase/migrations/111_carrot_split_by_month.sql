-- 111_carrot_split_by_month.sql
-- DATA FIX (corrects 110). Micheal 2026-11-22:
--   * every January 2026 carrot delivery was OXHEART  -> the 19 lines go back
--     to Oxheart Carrots, quantities and dollars untouched ($10,824.00)
--   * the November 2026 deliveries are PARISIAN, 20 carrots per LG ($24)
--     -> $1.20 each: 11/05 Press 60 ea $28.80 -> $72.00,
--        11/12 Under-Study 307 ea $1,074.50 -> $368.40 (net -$662.90)
--   * Oxheart is counted by the each: `ea` becomes its first unit,
--     default_price $29.63 -> $3.50 (unit_prices unchanged)
-- line_total is a generated column; deliveries.total_value follows by trigger.
-- Applied 2026-11-22 via the Supabase MCP.

UPDATE delivery_items di
   SET item_id = '4d2c4de4-0ca2-4e06-af78-4b8a80b11cc2'          -- Oxheart Carrots
  FROM deliveries d
 WHERE d.id = di.delivery_id
   AND di.item_id = '130ae3a7-68cc-4ba6-af84-b381eeb94459'       -- Parisian Carrots
   AND d.delivery_date BETWEEN '2026-01-01' AND '2026-01-31';

UPDATE delivery_items SET unit_price = 1.20
 WHERE id IN ('334a8fc0-764c-4ac7-8459-0432467aa05f',            -- 11/05 Press, was 0.48
              '2cb687ce-eaaf-4965-bf89-42b25f9c01fb');           -- 11/12 Under-Study, was 3.50

UPDATE items SET unit_prices = unit_prices || '{"ea": 1.2}'::jsonb
 WHERE id = '130ae3a7-68cc-4ba6-af84-b381eeb94459';

UPDATE items SET unit_type = 'ea,lg,sm,gb,lbs', default_price = 3.50   -- was 'lg,sm,gb,ea,lbs', 29.63
 WHERE id = '4d2c4de4-0ca2-4e06-af78-4b8a80b11cc2';
