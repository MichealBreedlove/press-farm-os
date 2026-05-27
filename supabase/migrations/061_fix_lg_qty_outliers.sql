-- ============================================
-- Press Farm OS — Migration 059: Targeted delivery + catalog corrections
--
-- Reviewed row-by-row with Micheal on 2026-05-27. Only the changes he
-- explicitly approved are included. All other rows surfaced during the
-- audit (Broccoli 50 LG, Kumquat Branches 80 LG, Turnip-Leaves 100 LG,
-- Cucumber Leaf 50 LG, Brassica 20 LG, Lettuce 20 EA @ $5, Squash
-- 45 EA @ $8, Cauliflower 100 LG, Eggplant @ $3 EA) were confirmed as
-- real deliveries and are NOT touched here.
--
-- line_total is a GENERATED column — recomputes automatically.
-- ============================================

BEGIN;

-- ============================================
-- A. Delivery row fixes — LG quantity reinterpreted as EA
-- (delicate items in 100+ quantities)
-- ============================================

-- A1. 2026-03-12 Press: Miners Lettuce 100 EA @ $15 → @ $0.30
--     (qty/unit were already EA but priced at the LG default; fix price)
UPDATE delivery_items di
SET unit_price = 0.30
FROM deliveries d
JOIN restaurants r ON r.id = d.restaurant_id
JOIN items       i ON i.name = 'Miners Lettuce'
WHERE di.delivery_id  = d.id
  AND di.item_id      = i.id
  AND d.delivery_date = DATE '2026-03-12'
  AND r.name          = 'Press'
  AND di.quantity     = 100
  AND di.unit         = 'ea'
  AND di.unit_price   = 15.00;

-- A2. 2026-03-23 Under-Study: Borage 130 LG @ $16 → 130 EA @ $0.32
UPDATE delivery_items di
SET unit = 'ea', unit_price = 0.32
FROM deliveries d
JOIN restaurants r ON r.id = d.restaurant_id
JOIN items       i ON i.name = 'Borage'
WHERE di.delivery_id  = d.id
  AND di.item_id      = i.id
  AND d.delivery_date = DATE '2026-03-23'
  AND r.name          = 'Under-Study'
  AND di.quantity     = 130
  AND di.unit         = 'lg'
  AND di.unit_price   = 16.00;

-- A3. 2026-03-23 Under-Study: Miners Lettuce 130 LG @ $15 → 130 EA @ $0.30
UPDATE delivery_items di
SET unit = 'ea', unit_price = 0.30
FROM deliveries d
JOIN restaurants r ON r.id = d.restaurant_id
JOIN items       i ON i.name = 'Miners Lettuce'
WHERE di.delivery_id  = d.id
  AND di.item_id      = i.id
  AND d.delivery_date = DATE '2026-03-23'
  AND r.name          = 'Under-Study'
  AND di.quantity     = 130
  AND di.unit         = 'lg'
  AND di.unit_price   = 15.00;

-- A4. 2026-03-23 Under-Study: Pea Flowers 120 LG @ $12 → 120 EA @ $0.24
UPDATE delivery_items di
SET unit = 'ea', unit_price = 0.24
FROM deliveries d
JOIN restaurants r ON r.id = d.restaurant_id
JOIN items       i ON i.name = 'Pea Flowers'
WHERE di.delivery_id  = d.id
  AND di.item_id      = i.id
  AND d.delivery_date = DATE '2026-03-23'
  AND r.name          = 'Under-Study'
  AND di.quantity     = 120
  AND di.unit         = 'lg'
  AND di.unit_price   = 12.00;

-- ============================================
-- B. Carrots (Ox Heart) price correction
-- Press carrots are Ox Heart variety, $3.50/ea premium.
-- 10 deliveries are recorded at $3.00/ea — bump to $3.50.
-- Catalog ea was $0.50 (very wrong) — set to $3.50 so future orders
-- price correctly.
-- ============================================

-- B1. Bump every $3.00 Carrots EA row up to $3.50
UPDATE delivery_items di
SET unit_price = 3.50
FROM items i
WHERE di.item_id    = i.id
  AND i.name        = 'Carrots'
  AND di.unit       = 'ea'
  AND di.unit_price = 3.00;

-- B2. Correct the Carrots catalog ea price
UPDATE items
SET unit_prices = unit_prices || jsonb_build_object('ea', 3.50)
WHERE name = 'Carrots'
  AND (unit_prices->>'ea')::numeric = 0.50;

-- ============================================
-- C. Eggplant catalog ea correction
-- Eggplants are $3/ea (premium variety). The 6 existing delivery rows
-- at $3/ea are correct. The catalog's $0.06/ea was wrong — set to $3.00.
-- No delivery rows changed.
-- ============================================

UPDATE items
SET unit_prices = unit_prices || jsonb_build_object('ea', 3.00)
WHERE name = 'Eggplant'
  AND (unit_prices->>'ea')::numeric = 0.06;

-- ============================================
-- D. Broccoli category reclassification
-- Per Micheal: Broccoli belongs in the vegetable category, not micros.
-- The historical 50-LG Broccoli deliveries (2025-01-23, 2025-01-24) are
-- whole heads, not microgreen flats — they were correctly priced, just
-- mis-categorized.
-- ============================================

UPDATE items
SET category = 'fruit_veg'
WHERE name = 'Broccoli'
  AND category = 'micros_leaves';

COMMIT;

-- ============================================
-- POST-MIGRATION REVIEW (run by hand — not executed)
-- ============================================

-- Verify delivery row fixes (A1–A4):
-- SELECT d.delivery_date, r.name AS restaurant, i.name AS item,
--        di.quantity, di.unit, di.unit_price, di.line_total
-- FROM delivery_items di
-- JOIN deliveries  d ON d.id = di.delivery_id
-- JOIN restaurants r ON r.id = d.restaurant_id
-- JOIN items       i ON i.id = di.item_id
-- WHERE (d.delivery_date, r.name, i.name) IN (
--   (DATE '2026-03-12', 'Press',       'Miners Lettuce'),
--   (DATE '2026-03-23', 'Under-Study', 'Borage'),
--   (DATE '2026-03-23', 'Under-Study', 'Miners Lettuce'),
--   (DATE '2026-03-23', 'Under-Study', 'Pea Flowers')
-- )
-- ORDER BY d.delivery_date;

-- Verify all Carrots EA rows now at $3.50:
-- SELECT d.delivery_date, r.name, di.quantity, di.unit_price, di.line_total
-- FROM delivery_items di
-- JOIN deliveries  d ON d.id = di.delivery_id
-- JOIN restaurants r ON r.id = d.restaurant_id
-- JOIN items       i ON i.id = di.item_id
-- WHERE i.name = 'Carrots' AND di.unit = 'ea'
-- ORDER BY d.delivery_date;

-- Verify catalog corrections:
-- SELECT name, category, unit_prices
-- FROM items
-- WHERE name IN ('Carrots','Eggplant','Broccoli');
