-- ============================================================
-- 044_repricing_2026_05_18.sql
--
-- Repricing pass from Micheal's 2026-05-18 list.
--
-- Scope: update prices ONLY on items that already exist.
-- Match: normalized name (within section's category)
--        + unit code present in items.unit_type.
--
-- Skipped sections:
--   * Micros - Flat (no /flat unit by user choice)
--   * Preservation (no prices listed)
--
-- 37 UPDATE statements / 112 unmatched.
-- See `-- UNMATCHED` block at bottom for rows needing review.
-- ============================================================

BEGIN;

-- [Flowers] Alyssum (white) -> Alyssum (sm) @ $12.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Alyssum' AND category = 'flowers';

-- [Flowers] Alyssum (purple) -> Alyssum (sm) @ $12.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Alyssum' AND category = 'flowers';

-- [Flowers] Bachelor Button - gapping -> Bachelor Button (sm) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Bachelor Button' AND category = 'flowers';

-- [Flowers] Borage -> Borage (sm) @ $15.00  [strict]
UPDATE items SET default_price = 15.00, unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(15.00::numeric), true), updated_at = now() WHERE name = 'Borage' AND category = 'flowers';

-- [Flowers] Buckwheat - White -> Buckwheat (sm) @ $12.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Buckwheat' AND category = 'flowers';

-- [Flowers] Buckwheat - Pink -> Buckwheat (sm) @ $12.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Buckwheat' AND category = 'flowers';

-- [Flowers] Calendula - Cultivated -> Calendula (sm) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Calendula' AND category = 'flowers';

-- [Flowers] Calendula - Cultivated -> Calendula (lg) @ $20.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(20.00::numeric), true), updated_at = now() WHERE name = 'Calendula' AND category = 'flowers';

-- [Flowers] Carrot -> Carrot (lg) @ $15.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(15.00::numeric), true), updated_at = now() WHERE name = 'Carrot' AND category = 'flowers';

-- [Flowers] Fava (100 ct) -> Fava Flowers (ea) @ $15.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(15.00::numeric), true), updated_at = now() WHERE name = 'Fava Flowers' AND category = 'flowers';

-- [Flowers] Nasturtium Flower -> Nasturtium (sm) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Nasturtium' AND category = 'flowers';

-- [Flowers] Nasturtium Flower -> Nasturtium (lg) @ $25.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(25.00::numeric), true), updated_at = now() WHERE name = 'Nasturtium' AND category = 'flowers';

-- [Flowers] Pea Mixed (50 ct) -> Pea Flowers (ea) @ $15.00  [tokens]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(15.00::numeric), true), updated_at = now() WHERE name = 'Pea Flowers' AND category = 'flowers';

-- [Flowers] Society Garlic (Purple) -> Society Garlic (sm) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Society Garlic' AND category = 'flowers';

-- [Flowers] Squash Blossom - Upcoming 2 weeks -> Squash Blossom (ea) @ $1.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(1.00::numeric), true), updated_at = now() WHERE name = 'Squash Blossom' AND category = 'flowers';

-- [Micros - Container] Borage (Oyster/Cucumber flavor) (25 ct) -> Borage (ea) @ $8.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(8.00::numeric), true), updated_at = now() WHERE name = 'Borage' AND category = 'micros_leaves';

-- [Micros - Container] Chervil - outgoing -> Chervil (sm) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Chervil' AND category = 'micros_leaves';

-- [Micros - Container] Cilantro -> Cilantro Micro (lg) @ $18.00  [tokens]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(18.00::numeric), true), updated_at = now() WHERE name = 'Cilantro Micro' AND category = 'micros_leaves';

-- [Micros - Container] Tiny Dill -> Dill (sm) @ $15.00  [tokens]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(15.00::numeric), true), updated_at = now() WHERE name = 'Dill' AND category = 'micros_leaves';

-- [Micros - Container] Fava Sprout (50 ct) -> Fava Sprout (ea) @ $12.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Fava Sprout' AND category = 'micros_leaves';

-- [Micros - Container] Lovage (50 ct) - Outgoing -> Lovage (ea) @ $12.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Lovage' AND category = 'micros_leaves';

-- [Foraged] Miners Lettuce Spades, Tiny (Dime) (50 ct) - Outgoing -> Miners Lettuce Spades (ea) @ $15.00  [tokens]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(15.00::numeric), true), updated_at = now() WHERE name = 'Miners Lettuce Spades' AND category = 'herbs_leaves';

-- [Herbs] Chrysanthemum -> Chrysanthemum (lg) @ $12.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Chrysanthemum' AND category = 'herbs_leaves';

-- [Herbs] Citrus Leaf -> Citrus Leaf (lg) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Citrus Leaf' AND category = 'herbs_leaves';

-- [Herbs] Mulberry Leaf (Young/Tender) (1-3 inch) (25 ct) -> Mulberry Leaf (ea) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Mulberry Leaf' AND category = 'herbs_leaves';

-- [Herbs] French Sorrel Stems (25 ct) - false rhubarb -> French Sorrel Stems (ea) @ $15.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(15.00::numeric), true), updated_at = now() WHERE name = 'French Sorrel Stems' AND category = 'herbs_leaves';

-- [Herbs] Geranium, Rose -> Rose Geranium (sm) @ $8.00  [tokens]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(8.00::numeric), true), updated_at = now() WHERE name = 'Rose Geranium' AND category = 'herbs_leaves';

-- [Herbs] Geranium, Rose -> Rose Geranium (lg) @ $12.00  [tokens]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Rose Geranium' AND category = 'herbs_leaves';

-- [Herbs] Lemon Balm -> Lemon Balm (lg) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Lemon Balm' AND category = 'herbs_leaves';

-- [Herbs] Spearmint -> Spearmint (lg) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Spearmint' AND category = 'herbs_leaves';

-- [Herbs] Stinging Nettle -> Stinging Nettle (lg) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Stinging Nettle' AND category = 'herbs_leaves';

-- [Herbs] Sunkissed Herbs Mix (Chervil, Peppercress, Bronze Fennel) - Outgoing -> Sunkissed Herbs Mix (sm) @ $20.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{sm}', to_jsonb(20.00::numeric), true), updated_at = now() WHERE name = 'Sunkissed Herbs Mix' AND category = 'herbs_leaves';

-- [Herbs] Rosemary -> Rosemary (lg) @ $10.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(10.00::numeric), true), updated_at = now() WHERE name = 'Rosemary' AND category = 'herbs_leaves';

-- [Fruit] Tiny Radish Pods (1"-1.5") (50 ct) -> Tiny Radish Pods (ea) @ $15.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(15.00::numeric), true), updated_at = now() WHERE name = 'Tiny Radish Pods' AND category = 'fruit_veg';

-- [Fruit] Radish Pods - Mixed Sizes -> Radish Pods (lg) @ $25.00  [strict]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{lg}', to_jsonb(25.00::numeric), true), updated_at = now() WHERE name = 'Radish Pods' AND category = 'fruit_veg';

-- [Garnish Veg] Tiny Pea Tendrils (50 ct) -> Field Pea Tendrils (ea) @ $12.00  [tokens]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Field Pea Tendrils' AND category = 'herbs_leaves';

-- [Garnish Veg] Tiny Sorrels - Burgundy (50 ct) -> Sorrels - Burgundy (ea) @ $12.00  [tokens]
UPDATE items SET unit_prices = jsonb_set(COALESCE(unit_prices, '{}'::jsonb), '{ea}', to_jsonb(12.00::numeric), true), updated_at = now() WHERE name = 'Sorrels - Burgundy' AND category = 'herbs_leaves';

COMMIT;

-- ============================================================
-- UNMATCHED — review manually
-- ============================================================
-- [Flowers] 'Anise Hyssop' @ $10.00 /small to-go
--   reason: no name match; cross-category candidate(s): ['Anise Hyssop (micros_leaves)']
-- [Flowers] 'Broccoli - White' @ $15.00 /quart
--   reason: no name match; cross-category candidate(s): ['Broccoli (micros_leaves)']
-- [Flowers] 'Broccoli - Yellow' @ $15.00 /quart
--   reason: no name match; cross-category candidate(s): ['Broccoli (micros_leaves)']
-- [Flowers] 'Chive - limited' @ $15.00 /small to-go
--   reason: no name match
-- [Flowers] 'Chrysanthemum, Yellow' @ $10.00 /small to-go
--   reason: no name match
-- [Flowers] 'Chrysanthemum, Yellow' @ $15.00 /large to-go
--   reason: no name match
-- [Flowers] 'Elderflower - Outgoing' @ $12.00 /large to-go
--   reason: no name match
-- [Flowers] 'Marigold, Gem (50 ct)' @ $12.00 /ea
--   reason: name match 'Gem Marigold' but unit 'ea' not in ['lg', 'sm'] (tokens)
-- [Flowers] 'Mustard Flower' @ $15.00 /quart
--   reason: name match 'Mustard' but unit 'qt' not in ['lg', 'sm'] (strict)
-- [Flowers] 'Nasturtium - Closed Buds (25 ct)' @ $10.00 /ea
--   reason: no name match
-- [Flowers] 'Peppercress (50 ct) - outgoing' @ $12.00 /ea
--   reason: name match 'Peppercress' but unit 'ea' not in ['lg', 'sm'] (strict)
-- [Flowers] 'Pineapple Weed (50 ct) - outgoing' @ $12.00 /large to-go
--   reason: no name match
-- [Flowers] 'Radish' @ $15.00 /quart
--   reason: name match 'Radish' but unit 'qt' not in ['ea', 'gb', 'lg', 'sm'] (strict)
-- [Flowers] 'Sorrel, Small Yellow  (100 ct)' @ $15.00 /ea
--   reason: no name match
-- [Flowers] 'Sorrel, Purple (100 ct)' @ $15.00 /ea
--   reason: no name match
-- [Flowers] 'Viola - Small (Purple)' @ $15.00 /small to-go
--   reason: no name match
-- [Flowers] 'Wasabi Arugula (50 ct) - outgoing' @ $12.00 /ea
--   reason: no name match; cross-category candidate(s): ['Wasabi Arugula (herbs_leaves)']
-- [Micros - Container] 'Basil - Purple' @ $15.00 /small to-go
--   reason: no name match; cross-category candidate(s): ['Basil (herbs_leaves)']
-- [Micros - Container] 'Basil - Green' @ $15.00 /small to-go
--   reason: no name match; cross-category candidate(s): ['Basil (herbs_leaves)']
-- [Micros - Container] 'Carrot' @ $12.00 /small to-go
--   reason: no name match; cross-category candidate(s): ['Carrot (flowers)']
-- [Micros - Container] 'Celery, Cutting (50 ct) - Outgoing' @ $12.00 /ea
--   reason: no name match
-- [Micros - Container] 'Chrysanthemum' @ $10.00 /small to-go
--   reason: no name match; cross-category candidate(s): ['Chrysanthemum, Flower (flowers)', 'Chrysanthemum (herbs_leaves)']
-- [Micros - Container] 'Fava' @ $12.00 /large to-go
--   reason: no name match; cross-category candidate(s): ['Fava Flowers (flowers)', 'Fava (herbs_leaves)']
-- [Micros - Container] 'Tiny Fennel, Bronze' @ $15.00 /small to-go
--   reason: no name match
-- [Micros - Container] 'Gem Marigold Leaf (50 ct)' @ $15.00 /ea
--   reason: name match 'Gem Marigold Leaf' but unit 'ea' not in ['lg', 'sm'] (strict)
-- [Micros - Container] 'Mustard, Dragons Tongue' @ $12.00 /large to-go
--   reason: no name match
-- [Micros - Container] 'Mustard, Frilly Red' @ $12.00 /large to-go
--   reason: no name match
-- [Micros - Container] 'Mustard Mix' @ $12.00 /large to-go
--   reason: no name match
-- [Micros - Container] 'Orach, Purple/Green' @ $20.00 /large to-go
--   reason: no name match
-- [Micros - Container] 'Pea - Frilly' @ $15.00 /large to-go
--   reason: no name match; cross-category candidate(s): ['Pea Flowers (flowers)']
-- [Micros - Container] 'Pea - Regular' @ $12.00 /large to-go
--   reason: no name match; cross-category candidate(s): ['Pea Flowers (flowers)']
-- [Micros - Container] 'Red Mizuna' @ $12.00 /large to-go
--   reason: no name match
-- [Micros - Container] 'Sorrel, Red Vein - Outgoing' @ $15.00 /small to-go
--   reason: no name match
-- [Micros - Container] 'Sweet Clover (50 ct)' @ $12.00 /ea
--   reason: no name match
-- [Foraged] 'California Bay Leaves' @ $15.00 /large to-go
--   reason: no name match
-- [Foraged] 'Sweet Bay' @ $10.00 /large to-go
--   reason: no name match
-- [Foraged] 'California Peppercorn Leaf' @ $12.00 /large to-go
--   reason: no name match
-- [Foraged] 'Spicebush (great for syrup)' @ $20.00 /lb
--   reason: name match 'Spicebush' but unit 'lbs' not in ['ea', 'gb', 'lg', 'sm'] (strict)
-- [Baby Roots] 'Turnip, Hakurei - Tiny Root (Pencil Eraser Size) (50 ct)' @ $25.00 /ea
--   reason: no name match
-- [Baby Roots] 'Radish, Red Round - Tiny Root (Pencil Eraser Size) (50 ct)' @ $25.00 /ea
--   reason: no name match
-- [Baby Roots] 'Radish, French Breakfast - Tiny Root (Pencil Eraser Size) (50 ct)' @ $25.00 /ea
--   reason: no name match
-- [Baby Roots] 'Turnip, Hakurei - Baby (pinky to index nail) (50 ct)' @ $25.00 /ea
--   reason: no name match
-- [Baby Roots] 'Radish, Red Round - Baby (pinky to index nail) (50 ct)' @ $25.00 /ea
--   reason: no name match
-- [Baby Roots] 'Radish, French Breakfast - Baby (pinky to index nail) (50 ct)' @ $25.00 /ea
--   reason: no name match
-- [Crudite Roots] 'Radish, Red Round - Crudite (thumbnail to quarter) (50 ct)' @ $25.00 /ea
--   reason: no name match
-- [Crudite Roots] 'Radish, French Breakfast - Crudite (thumbnail to quarter) (50 ct)' @ $25.00 /ea
--   reason: no name match
-- [Crudite Roots] 'Turnip, Hakurei - Crudite (thumbnail to quarter) (50 ct)' @ $25.00 /ea
--   reason: no name match
-- [Herbs] 'Anise Hyssop' @ $10.00 /large to-go
--   reason: no name match; cross-category candidate(s): ['Anise Hyssop (micros_leaves)']
-- [Herbs] 'Fennel Fronds (Green/Bronze)' @ $10.00 /large to-go
--   reason: no name match
-- [Herbs] 'Fennel Fronds - tighter leaves (Green/Bronze)' @ $12.00 /small to-go
--   reason: no name match
-- [Herbs] 'Fig Leaf' @ $20.00 /lb
--   reason: no name match
-- [Herbs] 'Fig Leaf - Perfect Hand Size' @ $0.50 /ea
--   reason: no name match
-- [Herbs] 'French Sorrel' @ $15.00 /lb
--   reason: no name match
-- [Herbs] 'Gem Marigold - Tiny Leaf (50 ct)' @ $15.00 /ea
--   reason: no name match; cross-category candidate(s): ['Gem Marigold (flowers)']
-- [Herbs] 'Gem Marigold Leaf' @ $10.00 /small to-go
--   reason: no name match; cross-category candidate(s): ['Gem Marigold Leaf (micros_leaves)']
-- [Herbs] 'Lemon Verbena' @ $10.00 /large to-go
--   reason: no name match
-- [Herbs] 'Lemon Verbena Tips (50 ct)' @ $12.00 /ea
--   reason: no name match
-- [Herbs] 'Lovage' @ $15.00 /lb
--   reason: name match 'Lovage' but unit 'lbs' not in ['ea', 'gb', 'lg', 'sm'] (strict)
-- [Herbs] 'Mint Tips, Mixed (Strawberry, Chocolate, Spearmint, Pineapple) (50 ct)' @ $10.00 /ea
--   reason: no name match
-- [Herbs] 'Mint Tips, Strawberry (50 ct)' @ $10.00 /ea
--   reason: no name match
-- [Herbs] 'Peach Leaf' @ $15.00 /lb
--   reason: no name match
-- [Herbs] 'Spearmint Tips' @ $10.00 /small to-go
--   reason: no name match
-- [Fruit] 'Tiny Fava Beans - 1.5-2.5 inches (50 ct)' @ $15.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Green Gem - Heart Leaf (2-3 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Green Gem - Palm Size Leaf (3-4 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Green Romaine - Heart Leaf (2-3 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Green Romaine - Palm Size Leaf (3-4 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Speckled Romaine - Heart Leaf (2-3 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Speckled Romaine - Palm Size Leaf (3-4 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Red Gem - Heart Leaf (2-3 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Red Gem - Palm Size Leaf (3-4 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Butterhead Lettuce - Heart Leaf (2-3 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Lettuce Cups] 'Butterhead Lettuce - Palm Size Leaf (3-4 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Leafy Veg] 'Celtuce' @ $2.50 /ea
--   reason: no name match
-- [Leafy Veg] 'Cover Crop - Pea/Fava Greens/Buckwheat/Radish Leaf' @ $15.00 /lb
--   reason: no name match
-- [Leafy Veg] 'Lettuce Heads, Little Gem, Green' @ $2.00 /ea
--   reason: no name match
-- [Leafy Veg] 'Lettuce Heads, Little Gem, Red' @ $2.00 /ea
--   reason: no name match
-- [Leafy Veg] 'Lettuce Heads, Mini Butterhead, Green' @ $2.00 /ea
--   reason: no name match
-- [Leafy Veg] 'Lettuce Heads, Dwarf Romaine, Green' @ $2.00 /ea
--   reason: no name match
-- [Broccoli/Raabs] 'Brassica - Heart Leaf (2-3 inches) (50 ct)' @ $18.00 /ea
--   reason: no name match
-- [Broccoli/Raabs] 'Kale, Ornamental Leaf, Mixed Colors (1.5-2.5 inches) (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Broccoli/Raabs] 'Kalettes, Ornamental, Mixed Colors (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Broccoli/Raabs] 'Daikon Raab (2-4 inches) (50 ct)' @ $18.00 /ea
--   reason: no name match; cross-category candidate(s): ['Daikon Raab (herbs_leaves)']
-- [Broccoli/Raabs] 'Sprouting Broccoli, Green (2-4 inches) (50 ct)' @ $18.00 /ea
--   reason: no name match
-- [Broccoli/Raabs] 'Sprouting Broccoli, Purple (2-4 inches) (50 ct)' @ $18.00 /ea
--   reason: no name match
-- [Broccoli/Raabs] 'Sprouting Broccoli - Green & Purple (BULK - Mixed Sizes/Colors)' @ $9.00 /lb
--   reason: no name match
-- [Garnish Veg] 'Anise Hyssop Tips (50 ct)' @ $12.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Anise Hyssop Leaf - Tiny (.5-1") (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Anise Hyssop Leaf (2") (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Fava Tip - Field (2"-3") (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Fava Sprout (1") (50 ct)' @ $12.00 /ea
--   reason: no name match; cross-category candidate(s): ['Fava Sprout (micros_leaves)']
-- [Garnish Veg] 'Fennel Fronds - tighter leaves (Green/Bronze)' @ $12.00 /small to-go
--   reason: no name match
-- [Garnish Veg] 'Frilly Red Mustard Leaf - Tiny (1-1.5") (50 ct)' @ $12.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Nasturtium (Dime-Nickel) (50 ct)' @ $20.00 /ea
--   reason: no name match; cross-category candidate(s): ['Nasturtium (flowers)']
-- [Garnish Veg] 'Nasturtium (Quarter-Silver Dollar) (50 ct)' @ $15.00 /ea
--   reason: no name match; cross-category candidate(s): ['Nasturtium (flowers)']
-- [Garnish Veg] 'Nasturtium (Palm) (50 ct)' @ $15.00 /ea
--   reason: no name match; cross-category candidate(s): ['Nasturtium (flowers)']
-- [Garnish Veg] 'Pea Tip/Tendril - Field (50 ct)' @ $20.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Tiny Sorrels - Mixed (Yellow, Green, Purple) (50 ct)' @ $12.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Tiny Sorrels - Yellow (50 ct)' @ $12.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Turnip Leaf - Tiny (1-2 inches)' @ $12.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Sorrel, Butterfly (Mixed Sizes)' @ $15.00 /large to-go
--   reason: no name match
-- [Garnish Veg] 'Sorrel, Butterfly (2-3 inch) (50 ct)' @ $15.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Succulent: Aptenia Plouche - Quarter/Silver Dollar Size (50 ct)' @ $15.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Succulent: Aptenia Leaf/Plouche - Dime size (50 ct)' @ $15.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Succulent: Iceplant (50 ct) - Outgoing' @ $15.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Succulent: New Zealand Spinach - Plouche (50 ct)' @ $15.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Succulent: New Zealand Spinach - Leaf (1-2 inches) (50 ct)' @ $15.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Succulent: Purslane Plouche, Dime-Nickel (50 ct)' @ $15.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Succulent: Purslane Plouche, Crudite (50 ct)' @ $15.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Succulent: Saltbush Tips (50 ct)' @ $15.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Sweet Clover (50 ct)' @ $12.00 /ea
--   reason: no name match
-- [Garnish Veg] 'Vetch Tendril - Quarter Size (50 ct)' @ $15.00 /ea
--   reason: no name match

-- ============================================================
-- MULTI-MATCH — used the first candidate
-- ============================================================
-- [Flowers] 'Borage' /small to-go -> ['Borage', 'Borage Flowers']
