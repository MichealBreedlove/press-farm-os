-- ============================================
-- Press Farm OS — Migration 047
-- Fix Nasturtium leaves miscategorized as Nasturtium Flowers
-- ============================================
--
-- Investigation 2026-05-26: of 441 delivery_items rows tagged as
-- "Nasturtium Flowers" (e4f4559b-dfd1-4432-b812-51d3672ef0e5), only ~33
-- are real flower orders. The rest are Nasturtium leaves
-- (51465d80-117d-44b3-b833-72e11fafd3cd, $0.40/ea) that were attached to
-- the wrong item.
--
-- Item IDs:
--   Leaves : Nasturtium          51465d80-117d-44b3-b833-72e11fafd3cd  ($0.40 ea)
--   Flowers: Nasturtium Flowers  e4f4559b-dfd1-4432-b812-51d3672ef0e5  ($7.50 sm / $15 lg)
--
-- Real flowers ship as sm/lg "to-go" containers only — never as `ea`, `qt`,
-- or in qty >=10. Confirmed with Micheal 2026-05-26.
--
-- Revenue impact: Bucket 2 reduces recorded revenue by ~$5,062 — those rows
-- billed leaves at flower prices. Buckets 1, 3, 4 are pure re-categorization
-- (no revenue change). The delivery total_value trigger will recompute each
-- affected deliveries row automatically.
-- ============================================

BEGIN;

-- ---------------------------------------------------------------
-- Bucket 1: 391 rows tagged "Nasturtium Flowers" with unit=ea.
-- Already priced as leaves (~$0.40 avg). Just repoint item_id.
-- No revenue impact.
-- ---------------------------------------------------------------
UPDATE delivery_items
SET item_id = '51465d80-117d-44b3-b833-72e11fafd3cd'
WHERE item_id = 'e4f4559b-dfd1-4432-b812-51d3672ef0e5'
  AND unit = 'ea';

-- ---------------------------------------------------------------
-- Bucket 4: 5 rows tagged unit=lg but priced at $0.40 — actual
-- leaves with wrong unit. Repoint item_id and fix unit to ea.
-- No revenue impact.
-- ---------------------------------------------------------------
UPDATE delivery_items
SET item_id = '51465d80-117d-44b3-b833-72e11fafd3cd',
    unit = 'ea'
WHERE item_id = 'e4f4559b-dfd1-4432-b812-51d3672ef0e5'
  AND unit = 'lg'
  AND unit_price <= 1.00;

-- ---------------------------------------------------------------
-- Bucket 2: 6 rows that were leaves but billed at flower prices.
-- Repoint to leaves, set unit=ea, reprice at $0.40, recompute line_total.
-- Revenue reduction: ~$5,062 total across Mar–Apr 2026.
-- ---------------------------------------------------------------
-- Note: line_total is a generated column (quantity * unit_price) and
-- recomputes automatically when unit_price changes.
UPDATE delivery_items
SET item_id    = '51465d80-117d-44b3-b833-72e11fafd3cd',
    unit       = 'ea',
    unit_price = 0.40
WHERE id IN (
  '351fa9fd-f171-48d9-8d37-039fd02480b8',  -- 2026-04-02 Press        50 sm @ $7.50  -> 50 ea @ $0.40
  '7234fdf7-bb9d-4f78-bc60-1994c8b565ce',  -- 2026-04-04 Press       100 sm @ $10.00 -> 100 ea @ $0.40
  '4b98a792-452b-4999-9520-b14edb1503b7',  -- 2026-04-06 Under-Study  50 sm @ $7.50  -> 50 ea @ $0.40
  'f7cb93de-7ad2-4562-b83c-677bedd4a6e4',  -- 2026-04-06 Press       200 lg @ $15.00 -> 200 ea @ $0.40
  '8388bdab-c3cf-413c-9dc6-8082e0eb8fab'   -- 2026-04-16 Press        50 sm @ $7.50  -> 50 ea @ $0.40
);

-- ---------------------------------------------------------------
-- Single qt row (2026-03-09 Press 8 qt @ $15) is actually 8 lg
-- to-go flowers. Stays as Nasturtium Flowers, fix unit.
-- No revenue impact.
-- ---------------------------------------------------------------
UPDATE delivery_items
SET unit = 'lg'
WHERE id = '5bedbf3e-75a7-4d75-806c-c0507bf40cac';

COMMIT;

-- ============================================
-- Post-migration verification (run separately to sanity-check):
--
--   SELECT i.name, di.unit, COUNT(*), SUM(di.line_total) AS revenue
--   FROM delivery_items di
--   JOIN items i ON i.id = di.item_id
--   WHERE i.name IN ('Nasturtium', 'Nasturtium Flowers')
--   GROUP BY i.name, di.unit
--   ORDER BY i.name, di.unit;
--
-- Expected after migration:
--   Nasturtium         | ea | ~397 rows  (was 391 + 5 + 6 - depending on
--                      |    | overlap with pre-existing leaves rows)
--   Nasturtium Flowers | lg | ~30 rows
--   Nasturtium Flowers | sm | ~6 rows
-- ============================================
