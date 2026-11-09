-- 096: Small-leaf catalog cleanup for the leaf-size inch guide (2026-11-09)
--
-- Chefs ordering the small leaves (Moonshadow, Kale Mix, Red Frills, Golden
-- Frills, Wasabina) now see the leaf length next to each size word on the
-- order form / review / history / harvest list (code: src/lib/leaf-sizes.ts):
--   Baby 1–2"  ·  Small 2–4"  ·  Medium 4–6"  ·  Large 6–10"
-- The size WORD stays the stored label; this migration only tidies the master
-- size lists those labels come from, so the picker reads smallest → largest
-- and every entry splits cleanly on ", ".
--
-- DATA-ONLY. Applied live 2026-11-09 via the Supabase MCP.
--
-- 1. Size lists → "Baby, Small, Medium, Large" (were out of order:
--    Moonshadow "Baby, Large, Medium, Small"; the frills / Wasabina / micro
--    Kale Mix "Small, Medium, Large, Baby").
UPDATE items SET size = 'Baby, Small, Medium, Large', updated_at = now()
WHERE is_archived = false
  AND id IN (
    '0a2eaec1-b9cf-4c22-a6d0-791e1116e470',  -- Moonshadow
    'baac3f42-c2c9-46d2-8694-63ce57c577da',  -- Red Frills Mustard
    '3086f903-cb31-44bd-a8f3-9eded0177cd7',  -- Golden Frills Mustard
    '5f503898-c493-4d8a-a7ed-e716a6072283',  -- Wasabina (was spelled Wasabinia)
    'f384a4f9-df47-4f23-8d26-36f16dcfd891'   -- Kale Mix (micros_leaves)
  );

-- 2. Typo fixes: a period instead of a comma fused two sizes into one
--    ("Small. Medium") on the order form and the admin size pickers.
UPDATE items SET size = 'Tiny, Small, Medium, Large', updated_at = now()
WHERE id = '99542fc9-02de-457b-88a7-030d2739f3ff' AND size = 'Tiny, Small. Medium, Large';   -- Kale Mix (herbs_leaves)
UPDATE items SET size = 'Small, Medium, Large', updated_at = now()
WHERE id = '2c264de2-e640-4d99-9193-659e497598b1' AND size = 'Small. Medium, Large';          -- Tomatillo

-- 3. Wasabina: correct the cultivar spelling (the repo photo is already
--    /assets/pressfarm/items/wasabina.jpg) and replace a chef note that
--    described some other plant ("Ornamental perennial with fine, feathery
--    foliage and pale pink or white flowers; minimal culinary use…").
UPDATE items
SET name = 'Wasabina',
    chef_notes = 'Japanese mustard green with a clean wasabi-like heat on the finish; deeply serrated leaves, tender and mild at baby size, sharper as they grow. Use raw in salads, as a finishing green on rich dishes, or briefly wilted.',
    updated_at = now()
WHERE id = '5f503898-c493-4d8a-a7ed-e716a6072283' AND name = 'Wasabinia';

-- Rollback:
-- UPDATE items SET size='Baby, Large, Medium, Small' WHERE id='0a2eaec1-b9cf-4c22-a6d0-791e1116e470';
-- UPDATE items SET size='Small, Medium, Large, Baby' WHERE id IN ('baac3f42-c2c9-46d2-8694-63ce57c577da','3086f903-cb31-44bd-a8f3-9eded0177cd7','5f503898-c493-4d8a-a7ed-e716a6072283','f384a4f9-df47-4f23-8d26-36f16dcfd891');
-- UPDATE items SET size='Tiny, Small. Medium, Large' WHERE id='99542fc9-02de-457b-88a7-030d2739f3ff';
-- UPDATE items SET size='Small. Medium, Large' WHERE id='2c264de2-e640-4d99-9193-659e497598b1';
-- UPDATE items SET name='Wasabinia', chef_notes='Ornamental perennial with fine, feathery foliage and pale pink or white flowers; minimal culinary use but valued for texture in mixed arrangements.' WHERE id='5f503898-c493-4d8a-a7ed-e716a6072283';
