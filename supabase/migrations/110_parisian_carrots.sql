-- 110: DATA — Parisian Carrots vs Oxheart Carrots
--
-- Micheal 2026-11-22: every carrot delivered in 2026 was a Parisian carrot,
-- not an Oxheart.
--   - New item "Parisian Carrots" (fruit_veg): LG $24, SM $12. `ea` is kept
--     as a unit (no price) because the moved lines were logged per carrot.
--   - The 21 delivery lines dated 2026 ($11,927.30) move from the old
--     "Carrots" rows (fruit_veg + the archived micros one) to it. Quantity,
--     unit, unit_price and line_total are NOT changed — only item_id — so
--     every delivery and report total is the same as before.
--   - The existing fruit_veg "Carrots" is renamed "Oxheart Carrots"
--     (variety Oxheart); it keeps the 2024–2025 history.
-- Applied 2026-11-22 via the Supabase MCP.
-- Rollback: point the 2026 lines back at the old ids, rename back, archive
-- "Parisian Carrots".

INSERT INTO items (farm_id,name,category,unit_type,default_price,unit_prices,chef_notes,source,is_archived,sort_order,image_url,variety,is_event_item,is_press_bar_item,show_in_regular_menu,parent_item_id,seasonal_months)
SELECT farm_id,'Parisian Carrots','fruit_veg','lg,sm,ea',24,'{"lg":24,"sm":12}'::jsonb,
  'Small, round Parisian carrots — sweet and tender, about the size of a radish.',
  source,false,sort_order,image_url,'Parisian',is_event_item,is_press_bar_item,show_in_regular_menu,id,seasonal_months
FROM items WHERE name IN ('Carrots','Oxheart Carrots') AND category='fruit_veg'
ON CONFLICT (farm_id,name,category) DO NOTHING;

UPDATE delivery_items di SET item_id = (SELECT id FROM items WHERE name='Parisian Carrots' AND category='fruit_veg')
FROM deliveries d
WHERE d.id = di.delivery_id AND d.delivery_date >= '2026-01-01'
  AND di.item_id IN (SELECT id FROM items WHERE name='Carrots' AND category IN ('fruit_veg','micros_leaves'));

UPDATE items SET name='Oxheart Carrots', variety='Oxheart', updated_at=now()
WHERE name='Carrots' AND category='fruit_veg';
