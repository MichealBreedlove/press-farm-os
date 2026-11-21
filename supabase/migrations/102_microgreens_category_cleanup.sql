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
