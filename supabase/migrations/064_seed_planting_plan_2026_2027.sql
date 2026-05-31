-- Migration 064: Full 12-month planting succession plan (Jun 2026 - May 2027)
-- =============================================================================
-- Populates the dated `plantings` calendar ONLY. Deliberately does NOT touch
-- `crop_plan_entries` (which already holds a curated ~549-row seasonal overview).
--
-- Region: Yountville, CA  -  USDA zone 9b / Sunset 14.
--   Last spring frost ~mid-March, first fall frost ~Dec 1.
--   Hot-dry summers (bolting is the limiter), mild-wet winters.
--   Two cool-season pushes (fall + late-winter/spring) for greens / brassicas /
--   cool flowers; one warm push (spring->summer) for basil / squash / tomatoes /
--   warm flowers; weekly indoor micros year-round.
--
-- Anchor cycle: 2026-06-01 -> 2027-05-31, season = 2026, status = 'planned'.
--
-- Conventions encoded below:
--   * planting_stock 'seeds'       -> Direct sow. The anchor date IS the sow date.
--   * planting_stock 'transplants' -> Started in trays `nursery` days before set-out;
--                                     transplant_date = anchor, sow_date = anchor - nursery.
--   * planting_stock 'cuttings'    -> Perennial herb/flower establishment (one event).
--   * planting_stock 'bulbs'       -> Garlic / seed potato.
--   * Micros are intentionally EXCLUDED from this plan - the microgreens module
--     (microgreen_crops / batches / trays) already owns weekly tray sowing.
--   * days_to_maturity is counted from the anchor date (sow for DS, transplant for TP).
--   * harvest_start = anchor + dtm; harvest_end = harvest_start + 14 (placeholder pick window).
--   * Two-window crops (fall + spring) appear as two template rows.
--   * "Single" establishment crops use step 999 so generate_series emits one row.
--
-- PLACEHOLDERS: quantity / beds / bed_feet / location are reasonable estimates
-- (derived by category + stock) for you to adjust per planting in the app.
-- Revenue fields (avg_yield / avg_price / projected_revenue) are intentionally
-- left NULL.
--
-- item_id is linked to the catalog by case-insensitive name match where one
-- exists; otherwise it stays NULL (the crop_name still carries the plan).
--
-- Perennial trees (citrus, fig, persimmon, passion fruit) and foraged `wilds`
-- (California bay, spicebush, miners-lettuce-wild, chickweed, nettle, etc.) are
-- intentionally omitted - they are not sown on a schedule.
-- =============================================================================

BEGIN;

WITH farm AS (
  SELECT id FROM farms WHERE name = 'Press Farm' ORDER BY created_at LIMIT 1
),
tpl (crop_name, variety, category, stock, method, dtm, nursery, win_start, win_end, step) AS (
  VALUES
   -- ================= SALAD & CUTTING LEAVES  (cool-season: fall + late-winter/spring) =================
   ('Arugula',               NULL,        'leaf','seeds',      'Direct sow',28,  0, DATE '2026-08-15', DATE '2026-11-15', 14),
   ('Arugula',               NULL,        'leaf','seeds',      'Direct sow',28,  0, DATE '2027-02-01', DATE '2027-04-15', 14),
   ('Wasabi Arugula',        NULL,        'leaf','seeds',      'Direct sow',30,  0, DATE '2026-08-15', DATE '2026-11-15', 21),
   ('Wasabi Arugula',        NULL,        'leaf','seeds',      'Direct sow',30,  0, DATE '2027-02-01', DATE '2027-04-15', 21),
   ('Salad Mix',             'Small Leaf','leaf','seeds',      'Direct sow',35,  0, DATE '2026-08-15', DATE '2026-11-15', 14),
   ('Salad Mix',             'Small Leaf','leaf','seeds',      'Direct sow',35,  0, DATE '2027-02-01', DATE '2027-04-15', 14),
   ('Salad Mix',             'Large Leaf','leaf','seeds',      'Direct sow',40,  0, DATE '2026-08-15', DATE '2026-11-15', 14),
   ('Salad Mix',             'Large Leaf','leaf','seeds',      'Direct sow',40,  0, DATE '2027-02-01', DATE '2027-04-15', 14),
   ('Mustard Greens',        NULL,        'leaf','seeds',      'Direct sow',35,  0, DATE '2026-08-15', DATE '2026-11-15', 21),
   ('Mustard Greens',        NULL,        'leaf','seeds',      'Direct sow',35,  0, DATE '2027-02-01', DATE '2027-04-15', 21),
   ('Tatsoi',                NULL,        'leaf','transplants','Transplant', 40, 28, DATE '2026-08-15', DATE '2026-10-15', 21),
   ('Tatsoi',                NULL,        'leaf','transplants','Transplant', 40, 28, DATE '2027-01-15', DATE '2027-03-01', 21),
   ('Red Mizuna',            NULL,        'leaf','seeds',      'Direct sow',35,  0, DATE '2026-08-15', DATE '2026-11-15', 21),
   ('Red Mizuna',            NULL,        'leaf','seeds',      'Direct sow',35,  0, DATE '2027-02-01', DATE '2027-04-15', 21),
   ('Lettuce',               'Little Gem','leaf','transplants','Transplant', 55, 30, DATE '2026-08-15', DATE '2026-11-15', 14),
   ('Lettuce',               'Little Gem','leaf','transplants','Transplant', 55, 30, DATE '2027-01-15', DATE '2027-04-15', 14),
   ('Lettuce',               'Butterhead','leaf','transplants','Transplant', 55, 30, DATE '2026-08-15', DATE '2026-11-15', 14),
   ('Lettuce',               'Butterhead','leaf','transplants','Transplant', 55, 30, DATE '2027-01-15', DATE '2027-04-15', 14),
   ('Kale, Flowering',       NULL,        'leaf','transplants','Transplant', 60, 30, DATE '2026-08-01', DATE '2026-08-01', 999),
   ('Kale, Flowering',       NULL,        'leaf','transplants','Transplant', 60, 30, DATE '2027-02-01', DATE '2027-02-01', 999),
   ('Miners Lettuce',        NULL,        'leaf','seeds',      'Direct sow',45,  0, DATE '2026-09-15', DATE '2026-11-15', 21),

   -- ================= BRASSICA RAAB & FLOWERING BRASSICAS =================
   ('Sprouting Broccoli',    NULL,        'brassicas','transplants','Transplant',65, 35, DATE '2026-08-01', DATE '2026-09-15', 21),
   ('Sprouting Broccoli',    NULL,        'brassicas','transplants','Transplant',65, 35, DATE '2027-01-15', DATE '2027-02-15', 21),
   ('Daikon Raab',           'field',     'brassicas','seeds',      'Direct sow',45,  0, DATE '2026-09-01', DATE '2026-10-15', 21),
   ('Daikon Raab',           'field',     'brassicas','seeds',      'Direct sow',45,  0, DATE '2027-02-01', DATE '2027-03-01', 21),
   ('Bok Choy',              NULL,        'brassicas','transplants','Transplant',50, 28, DATE '2026-08-15', DATE '2026-10-01', 21),
   ('Bok Choy',              NULL,        'brassicas','transplants','Transplant',50, 28, DATE '2027-01-15', DATE '2027-03-01', 21),

   -- ================= BABY ROOTS =================
   ('Radish',                'Cherry Belle',    'roots','seeds','Direct sow',27, 0, DATE '2026-08-15', DATE '2026-11-15', 14),
   ('Radish',                'Cherry Belle',    'roots','seeds','Direct sow',27, 0, DATE '2027-02-01', DATE '2027-04-15', 14),
   ('Radish',                'French Breakfast','roots','seeds','Direct sow',28, 0, DATE '2026-08-15', DATE '2026-11-15', 14),
   ('Radish',                'French Breakfast','roots','seeds','Direct sow',28, 0, DATE '2027-02-01', DATE '2027-04-15', 14),
   ('Turnip, Hakurei',       NULL,              'roots','seeds','Direct sow',38, 0, DATE '2026-08-15', DATE '2026-10-15', 14),
   ('Turnip, Hakurei',       NULL,              'roots','seeds','Direct sow',38, 0, DATE '2027-02-01', DATE '2027-03-15', 14),
   ('Beets',                 NULL,              'roots','seeds','Direct sow',50, 0, DATE '2026-08-15', DATE '2026-09-30', 21),
   ('Beets',                 NULL,              'roots','seeds','Direct sow',50, 0, DATE '2027-02-01', DATE '2027-03-15', 21),
   ('Carrots',               'Ox Heart',        'roots','seeds','Direct sow',75, 0, DATE '2026-08-15', DATE '2026-09-30', 21),
   ('Carrots',               'Ox Heart',        'roots','seeds','Direct sow',75, 0, DATE '2027-02-01', DATE '2027-03-01', 21),

   -- ================= ANNUAL CULINARY HERBS =================
   ('Cilantro',              NULL,        'herbs','seeds',      'Direct sow',50,  0, DATE '2026-08-15', DATE '2026-11-15', 14),
   ('Cilantro',              NULL,        'herbs','seeds',      'Direct sow',50,  0, DATE '2027-02-01', DATE '2027-04-15', 14),
   ('Dill',                  NULL,        'herbs','seeds',      'Direct sow',45,  0, DATE '2026-08-15', DATE '2026-09-30', 21),
   ('Dill',                  NULL,        'herbs','seeds',      'Direct sow',45,  0, DATE '2027-03-01', DATE '2027-05-01', 21),
   ('Chervil',               NULL,        'herbs','seeds',      'Direct sow',50,  0, DATE '2026-08-15', DATE '2026-10-01', 21),
   ('Chervil',               NULL,        'herbs','seeds',      'Direct sow',50,  0, DATE '2027-02-01', DATE '2027-03-01', 21),
   ('Basil, Genovese',       NULL,        'herbs','seeds',      'Direct sow',60,  0, DATE '2026-06-01', DATE '2026-07-15', 21),
   ('Basil, Genovese',       NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2027-04-15', DATE '2027-05-15', 30),
   ('Basil, Thai',           NULL,        'herbs','seeds',      'Direct sow',60,  0, DATE '2026-06-01', DATE '2026-07-15', 21),
   ('Basil, Thai',           NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2027-04-15', DATE '2027-05-15', 30),
   ('Basil, Holy',           NULL,        'herbs','seeds',      'Direct sow',60,  0, DATE '2026-06-01', DATE '2026-07-15', 21),
   ('Basil, Holy',           NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2027-04-15', DATE '2027-05-15', 30),
   ('Basil, Purple',         NULL,        'herbs','seeds',      'Direct sow',60,  0, DATE '2026-06-01', DATE '2026-07-15', 21),
   ('Basil, Purple',         NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2027-04-15', DATE '2027-05-15', 30),
   ('Shiso Green',           NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2026-06-01', DATE '2026-06-01', 999),
   ('Shiso Green',           NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2027-04-15', DATE '2027-04-15', 999),
   ('Shiso Purple',          NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2026-06-01', DATE '2026-06-01', 999),
   ('Shiso Purple',          NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2027-04-15', DATE '2027-04-15', 999),
   ('Fennel',                'Bronze',    'herbs','transplants','Transplant', 65, 30, DATE '2026-08-15', DATE '2026-08-15', 999),
   ('Fennel',                'Bronze',    'herbs','transplants','Transplant', 65, 30, DATE '2027-02-15', DATE '2027-02-15', 999),
   ('Anise Hyssop',          NULL,        'herbs','transplants','Transplant', 70, 35, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Chamomile',             NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2026-09-01', DATE '2026-09-01', 999),
   ('Chamomile',             NULL,        'herbs','transplants','Transplant', 60, 35, DATE '2027-02-15', DATE '2027-02-15', 999),

   -- ================= PERENNIAL HERBS  (establish once; spring root window) =================
   ('Rosemary',              NULL,        'herbs','cuttings',   'Establish from cuttings',  90, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Thyme',                 NULL,        'herbs','transplants','Establish transplant',     75, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Sage',                  NULL,        'herbs','transplants','Establish transplant',     75, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Oregano',               NULL,        'herbs','transplants','Establish transplant',     70, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Marjoram',              NULL,        'herbs','transplants','Establish transplant',     70, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Tarragon',              NULL,        'herbs','transplants','Establish / divide',       70, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Lemon Balm',            NULL,        'herbs','transplants','Establish transplant',     70, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Lemon Verbena',         NULL,        'herbs','transplants','Establish transplant',     80, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Bay Leaf',              NULL,        'herbs','transplants','Establish transplant',    120, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Lovage',                NULL,        'herbs','transplants','Establish transplant',     80, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('French Sorrel',         NULL,        'herbs','transplants','Establish transplant',     60, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Stinging Nettle',       NULL,        'herbs','transplants','Establish transplant',     60, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Mint, Spearmint',       NULL,        'herbs','cuttings',   'Establish from cuttings',  60, 0, DATE '2027-03-01', DATE '2027-03-01', 999),
   ('Mint, Chocolate',       NULL,        'herbs','cuttings',   'Establish from cuttings',  60, 0, DATE '2027-03-01', DATE '2027-03-01', 999),
   ('Mint, Moroccan',        NULL,        'herbs','cuttings',   'Establish from cuttings',  60, 0, DATE '2027-03-01', DATE '2027-03-01', 999),
   ('Mint, Orange',          NULL,        'herbs','cuttings',   'Establish from cuttings',  60, 0, DATE '2027-03-01', DATE '2027-03-01', 999),
   ('Mint, Pineapple',       NULL,        'herbs','cuttings',   'Establish from cuttings',  60, 0, DATE '2027-03-01', DATE '2027-03-01', 999),
   ('Mint, Mojito',          NULL,        'herbs','cuttings',   'Establish from cuttings',  60, 0, DATE '2027-03-01', DATE '2027-03-01', 999),
   ('Mint, Strawberry',      NULL,        'herbs','cuttings',   'Establish from cuttings',  60, 0, DATE '2027-03-01', DATE '2027-03-01', 999),
   ('Mint, Japanese',        NULL,        'herbs','cuttings',   'Establish from cuttings',  60, 0, DATE '2027-03-01', DATE '2027-03-01', 999),

   -- ================= EDIBLE FLOWERS =================
   ('Viola',                 NULL,        'flowers','transplants','Transplant', 60, 42, DATE '2026-09-01', DATE '2026-10-01', 21),
   ('Viola',                 NULL,        'flowers','transplants','Transplant', 60, 42, DATE '2027-01-15', DATE '2027-03-01', 21),
   ('Pansy',                 NULL,        'flowers','transplants','Transplant', 60, 42, DATE '2026-09-01', DATE '2026-10-01', 21),
   ('Pansy',                 NULL,        'flowers','transplants','Transplant', 60, 42, DATE '2027-01-15', DATE '2027-03-01', 21),
   ('Calendula',             NULL,        'flowers','transplants','Transplant', 60, 35, DATE '2026-09-01', DATE '2026-10-01', 21),
   ('Calendula',             NULL,        'flowers','transplants','Transplant', 60, 35, DATE '2027-01-15', DATE '2027-03-01', 21),
   ('Alyssum',               NULL,        'flowers','transplants','Transplant', 55, 35, DATE '2026-09-01', DATE '2026-10-01', 21),
   ('Alyssum',               NULL,        'flowers','transplants','Transplant', 55, 35, DATE '2027-01-15', DATE '2027-03-01', 21),
   ('Bachelor Button',       NULL,        'flowers','seeds',      'Direct sow',65,  0, DATE '2026-10-01', DATE '2026-10-01', 999),
   ('Bachelor Button',       NULL,        'flowers','seeds',      'Direct sow',65,  0, DATE '2027-02-15', DATE '2027-02-15', 999),
   ('Dianthus',              NULL,        'flowers','transplants','Transplant', 70, 42, DATE '2026-09-15', DATE '2026-09-15', 999),
   ('Dianthus',              NULL,        'flowers','transplants','Transplant', 70, 42, DATE '2027-02-01', DATE '2027-02-01', 999),
   ('Forget-Me-Nots',        NULL,        'flowers','transplants','Transplant', 65, 42, DATE '2026-09-15', DATE '2026-09-15', 999),
   ('Nasturtium',            NULL,        'flowers','seeds',      'Direct sow',50,  0, DATE '2026-06-01', DATE '2026-07-01', 21),
   ('Nasturtium',            NULL,        'flowers','seeds',      'Direct sow',50,  0, DATE '2027-03-15', DATE '2027-05-01', 21),
   ('Borage',                NULL,        'flowers','seeds',      'Direct sow',55,  0, DATE '2026-06-01', DATE '2026-06-01', 999),
   ('Borage',                NULL,        'flowers','seeds',      'Direct sow',55,  0, DATE '2027-03-01', DATE '2027-03-01', 999),
   ('Cosmos',                NULL,        'flowers','transplants','Transplant', 70, 30, DATE '2026-06-01', DATE '2026-06-01', 999),
   ('Cosmos',                NULL,        'flowers','transplants','Transplant', 70, 30, DATE '2027-04-15', DATE '2027-04-15', 999),
   ('Marigold',              NULL,        'flowers','transplants','Transplant', 60, 30, DATE '2026-06-01', DATE '2026-06-01', 999),
   ('Marigold',              NULL,        'flowers','transplants','Transplant', 60, 30, DATE '2027-04-15', DATE '2027-04-15', 999),
   ('Gem Marigold',          NULL,        'flowers','transplants','Transplant', 60, 30, DATE '2026-06-01', DATE '2026-06-01', 999),
   ('Gem Marigold',          NULL,        'flowers','transplants','Transplant', 60, 30, DATE '2027-04-15', DATE '2027-04-15', 999),
   ('Sunflower',             NULL,        'flowers','seeds',      'Direct sow',65,  0, DATE '2026-06-01', DATE '2026-07-15', 21),
   ('Sunflower',             NULL,        'flowers','seeds',      'Direct sow',65,  0, DATE '2027-04-15', DATE '2027-05-15', 21),
   ('Chive',                 NULL,        'flowers','transplants','Establish transplant', 70, 0, DATE '2027-03-15', DATE '2027-03-15', 999),
   ('Garlic Chive',          NULL,        'flowers','transplants','Establish transplant', 70, 0, DATE '2027-03-15', DATE '2027-03-15', 999),

   -- ================= FRUIT & SUMMER VEG =================
   -- Tomatoes & peppers are handled separately below as ACTUAL 2026 plantings (real varieties).
   ('Eggplant',              NULL,        'fruit','transplants','Transplant', 75, 56, DATE '2027-04-20', DATE '2027-04-20', 999),
   ('Cucumber',              NULL,        'fruit','seeds',      'Direct sow',55,  0, DATE '2026-06-01', DATE '2026-07-01', 21),
   ('Cucumber',              NULL,        'fruit','seeds',      'Direct sow',55,  0, DATE '2027-04-20', DATE '2027-05-31', 21),
   ('Squash, Summer',        'Zucchini',  'fruit','seeds',      'Direct sow',50,  0, DATE '2026-06-01', DATE '2026-07-15', 21),
   ('Squash, Summer',        'Zucchini',  'fruit','seeds',      'Direct sow',50,  0, DATE '2027-04-15', DATE '2027-05-31', 21),
   ('Beans',                 NULL,        'fruit','seeds',      'Direct sow',60,  0, DATE '2026-06-01', DATE '2026-07-01', 21),
   ('Beans',                 NULL,        'fruit','seeds',      'Direct sow',60,  0, DATE '2027-04-20', DATE '2027-05-31', 21),
   ('Fava',                  NULL,        'fruit','seeds',      'Direct sow',90,  0, DATE '2026-10-15', DATE '2026-11-15', 21),
   ('Peas, Sugar Snap',      NULL,        'fruit','seeds',      'Direct sow',65,  0, DATE '2026-10-01', DATE '2026-10-31', 14),
   ('Peas, Sugar Snap',      NULL,        'fruit','seeds',      'Direct sow',65,  0, DATE '2027-01-15', DATE '2027-02-15', 14),
   ('Garlic',                NULL,        'fruit','bulbs',      'Plant cloves',     240, 0, DATE '2026-11-01', DATE '2026-11-01', 999),
   ('Leek',                  NULL,        'fruit','transplants','Transplant',100, 56, DATE '2026-08-15', DATE '2026-08-15', 999),
   ('Leek',                  NULL,        'fruit','transplants','Transplant',100, 56, DATE '2027-02-15', DATE '2027-02-15', 999),
   ('Green Onion',           NULL,        'fruit','transplants','Transplant', 60, 35, DATE '2026-08-15', DATE '2026-08-15', 999),
   ('Green Onion',           NULL,        'fruit','transplants','Transplant', 60, 35, DATE '2027-02-15', DATE '2027-02-15', 999),
   ('New Zealand Spinach',   NULL,        'fruit','seeds',      'Direct sow',55,  0, DATE '2026-06-01', DATE '2026-06-01', 999),
   ('New Zealand Spinach',   NULL,        'fruit','seeds',      'Direct sow',55,  0, DATE '2027-04-15', DATE '2027-04-15', 999)
)
INSERT INTO plantings (
  farm_id, item_id, crop_name, variety, category, growing_location,
  planting_stock, sowing_method, sow_date, transplant_date,
  days_to_maturity, harvest_start, harvest_end,
  quantity, quantity_unit, beds, bed_feet, location, status, season, notes
)
SELECT
  f.id,
  (SELECT i.id FROM items i WHERE i.farm_id = f.id AND lower(i.name) = lower(t.crop_name) LIMIT 1),
  t.crop_name,
  t.variety,
  t.category,
  CASE WHEN t.category = 'micro' THEN 'in_containers' ELSE 'in_ground' END,
  t.stock,
  t.method,
  CASE WHEN t.stock = 'transplants'
       THEN (g.d - (t.nursery || ' days')::interval)::date
       ELSE g.d::date END                                                AS sow_date,
  CASE WHEN t.stock = 'transplants' THEN g.d::date ELSE NULL END          AS transplant_date,
  t.dtm,
  (g.d + (t.dtm || ' days')::interval)::date                             AS harvest_start,
  (g.d + ((t.dtm + 14) || ' days')::interval)::date                      AS harvest_end,
  CASE
    WHEN t.category = 'micro'                          THEN 4
    WHEN t.stock IN ('transplants','plugs','cuttings') THEN 72
    WHEN t.stock = 'bulbs'                             THEN 100
    ELSE NULL
  END                                                                    AS quantity,
  CASE
    WHEN t.category = 'micro'                          THEN 'trays'
    WHEN t.stock IN ('transplants','plugs','cuttings') THEN 'plants'
    WHEN t.stock = 'bulbs'                             THEN 'bulbs'
    ELSE 'bed_feet'
  END                                                                    AS quantity_unit,
  CASE WHEN t.category = 'micro' THEN NULL ELSE 1  END                   AS beds,
  CASE WHEN t.category = 'micro' THEN NULL ELSE 50 END                   AS bed_feet,
  CASE
    WHEN t.category = 'micro'    THEN 'Microgreen Racks'
    WHEN t.category = 'flowers'  THEN 'Flower Rows'
    WHEN t.stock = 'cuttings'    THEN 'Perennial Border'
    ELSE 'Field Beds'
  END                                                                    AS location,
  'planned',
  2026,
  'Auto-generated 12-month succession plan (zone 9b). Placeholder qty/beds/location - adjust as committed.'
FROM tpl t
CROSS JOIN farm f
CROSS JOIN LATERAL generate_series(t.win_start, t.win_end, (t.step || ' days')::interval) AS g(d);

-- =============================================================================
-- ACTUAL 2026 WARM-SEASON FRUITING CROP
-- Tomatoes & peppers Micheal confirmed are already in the ground this season.
-- Transplanted ~mid-April 2026, so status = 'growing' (not 'planned').
-- One row per real variety; days_to_maturity counted from transplant date.
-- quantity/beds are placeholders to adjust in the app.
-- =============================================================================
WITH farm AS (
  SELECT id FROM farms WHERE name = 'Press Farm' ORDER BY created_at LIMIT 1
),
actual (crop_name, variety, dtm, nursery, tp_date) AS (
  VALUES
   ('Tomato', 'Red Currant',            70, 42, DATE '2026-04-15'),
   ('Tomato', 'Early Girl',             55, 42, DATE '2026-04-15'),
   ('Tomato', 'Sun Gold',               57, 42, DATE '2026-04-15'),
   ('Tomato', 'Unity',                  70, 42, DATE '2026-04-15'),
   ('Tomato', 'Brown Sugar',            70, 42, DATE '2026-04-15'),
   ('Tomato', 'Black Krim',             80, 42, DATE '2026-04-15'),
   ('Tomato', 'Black Prince',           70, 42, DATE '2026-04-15'),
   ('Tomato', 'Spears Tennessee Green', 80, 42, DATE '2026-04-15'),
   ('Pepper', 'Marconi Red',            80, 56, DATE '2026-04-15'),
   ('Pepper', 'Habanada',               75, 56, DATE '2026-04-15'),
   ('Pepper', 'Jimmy Nardello',         85, 56, DATE '2026-04-15'),
   ('Pepper', 'Aji Dulce',              90, 56, DATE '2026-04-15'),
   ('Pepper', 'Aji Amarillo',          100, 56, DATE '2026-04-15')
)
INSERT INTO plantings (
  farm_id, item_id, crop_name, variety, category, growing_location,
  planting_stock, sowing_method, sow_date, transplant_date,
  days_to_maturity, harvest_start, harvest_end,
  quantity, quantity_unit, beds, bed_feet, location, status, season, notes
)
SELECT
  f.id,
  (SELECT i.id FROM items i WHERE i.farm_id = f.id AND lower(i.name) = lower(a.crop_name) LIMIT 1),
  a.crop_name,
  a.variety,
  'fruit',
  'in_ground',
  'transplants',
  'Transplant',
  (a.tp_date - (a.nursery || ' days')::interval)::date                     AS sow_date,
  a.tp_date                                                                AS transplant_date,
  a.dtm,
  (a.tp_date + (a.dtm || ' days')::interval)::date                         AS harvest_start,
  (a.tp_date + ((a.dtm + 21) || ' days')::interval)::date                  AS harvest_end,
  12,
  'plants',
  1,
  25,
  'Field Beds',
  'growing',
  2026,
  'Actual 2026 planting - variety confirmed by Micheal. Transplanted mid-April 2026.'
FROM actual a
CROSS JOIN farm f;

COMMIT;
