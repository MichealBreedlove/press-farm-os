-- 102: DATA — the Microgreens category holds only tray-grown microgreens
--
-- `micros_leaves` is now labelled "Microgreens" (self-harvest, not
-- orderable), so the field-cut leaves / tendrils that had been filed there
-- move to Herbs & Leaves, per Micheal's list of 2026-11-21.
--
--   Moved to herbs_leaves (17): Ornamental Kale, Ornamental Cabbage,
--     Brussel Sprouts, Cucamelon Leaf / Tendril / Tips, Cucumber Tendril,
--     Squash Tendril, Garbanzo Tendril, Vetch Tendril, Malabar Spinach,
--     Iceplant, Purslane, Chives, Onions, Watercress, Fennel.
--     (The archived, never-delivered herbs_leaves "Fennel" is renamed
--     "Fennel (old duplicate)" first — UNIQUE(farm_id, name, category).)
--   Archived (2): the micros_leaves "Lovage" (a herbs_leaves Lovage already
--     exists) and the micros_leaves "Carrots" (Carrots live in fruit_veg).
--   Stay Microgreens (15): Amaranth, Anise Hyssop, Beet, Borage, Celery,
--     Chervil, Cilantro Micro, Citrus Leaf Shoots, Cress, Dill, Fava Leaf,
--     Fava Sprout, Gem Marigold Leaf, Kale Mix, Pea Tendrils, Radish Shoots,
--     Sunflower Sprouts. (Fava Leaf and Gem Marigold Leaf are grown both
--     ways; they stay here for now.)
--
-- Item ids are unchanged, so orders / deliveries / availability keep
-- pointing at the same rows; only the category a past sale is reported
-- under changes. Applied 2026-11-21 via the Supabase MCP.
--
-- Rollback: set category back to 'micros_leaves' for the 17 names, un-archive
-- the two rows, rename "Fennel (old duplicate)" back to "Fennel".

UPDATE items SET name = 'Fennel (old duplicate)', updated_at = now()
WHERE name = 'Fennel' AND category = 'herbs_leaves' AND is_archived = true;

UPDATE items SET category = 'herbs_leaves', updated_at = now()
WHERE category = 'micros_leaves'
  AND name IN ('Ornamental Kale','Ornamental Cabbage','Brussel Sprouts','Cucamelon Leaf',
               'Cucamelon Tendril','Cucamelon Tips','Cucumber Tendril','Squash Tendril',
               'Garbanzo Tendril','Vetch Tendril','Malabar Spinach','Iceplant','Purslane',
               'Chives','Onions','Watercress','Fennel');

UPDATE items SET is_archived = true, updated_at = now()
WHERE category = 'micros_leaves' AND name IN ('Lovage','Carrots');

-- Follow-up the same day (Micheal): Onions and Brussel Sprouts are
-- vegetables — they go to Fruit & Veg, not Herbs & Leaves.
UPDATE items SET category = 'fruit_veg', updated_at = now()
WHERE category = 'herbs_leaves' AND name IN ('Onions', 'Brussel Sprouts');

-- Correction (Micheal, same day): the "Onions" row (sizes Tiny, Micro) is the
-- TRAY-onion placeholder — not grown yet, kept for when it is — so it goes
-- back to Microgreens. The field onions are the separate fruit_veg rows:
-- "Onion" (thumb-sized) and "Spring Onion" (scallion type).
UPDATE items SET category = 'micros_leaves', updated_at = now()
WHERE category = 'fruit_veg' AND name = 'Onions';

-- Renamed so it can't be confused with the field "Onion" (never ordered or
-- delivered, so nothing else references the old name).
UPDATE items SET name = 'Onion Micro', updated_at = now()
WHERE category = 'micros_leaves' AND name = 'Onions';

-- Every microgreen now reads as one (Micheal 2026-11-21): 13 names that
-- collided with, or sat next to, a field / flower item gain a " Micro"
-- suffix (Kale Mix → Kale Mix Micro, Borage → Borage Micro, …). Already
-- unambiguous and left alone: Cilantro Micro, Onion Micro, Fava Sprout,
-- Radish Shoots, Sunflower Sprouts. Ids unchanged; microgreen_crops links by
-- item_id, and every renamed item has its own image_url.
UPDATE items SET name = name || ' Micro', updated_at = now()
WHERE category = 'micros_leaves' AND is_archived = false
  AND name IN ('Kale Mix','Borage','Beet','Celery','Amaranth','Anise Hyssop','Cress',
               'Pea Tendrils','Fava Leaf','Gem Marigold Leaf','Citrus Leaf Shoots','Chervil','Dill');

-- Gem Marigold Leaf is grown both ways (Micheal 2026-11-21): the tray crop
-- stays "Gem Marigold Leaf Micro" (Microgreens) and a field "Gem Marigold
-- Leaf" is added under Herbs & Leaves as a copy of it. Gem Marigold FLOWERS
-- are field-only — the existing flowers "Gem Marigold" row, no micro twin.
INSERT INTO items (farm_id,name,category,unit_type,default_price,chef_notes,internal_notes,source,is_archived,sort_order,image_url,season_status,season_note,size,variety,color,unit_prices,is_event_item,is_press_bar_item,show_in_regular_menu,parent_item_id,seasonal_months,size_prices)
SELECT farm_id,'Gem Marigold Leaf','herbs_leaves',unit_type,default_price,chef_notes,internal_notes,source,false,sort_order,image_url,season_status,season_note,size,variety,color,unit_prices,is_event_item,is_press_bar_item,show_in_regular_menu,parent_item_id,seasonal_months,size_prices
FROM items WHERE name='Gem Marigold Leaf Micro' AND category='micros_leaves'
ON CONFLICT (farm_id,name,category) DO UPDATE SET is_archived=false, updated_at=now();
