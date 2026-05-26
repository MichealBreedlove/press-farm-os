-- supabase/migrations/059_items_seasonal_months.sql
--
-- Add seasonal_months int[] column to items + seed from past 12 months of
-- delivery_items. Powers the far-future zone of /order/forecast where there
-- is no concrete planted data yet.
--
-- After this migration runs, admin can toggle month chips per item on
-- /admin/items/[id]. Chef forecast page reads from this column for any
-- month outside the concrete planting window.

ALTER TABLE items
  ADD COLUMN seasonal_months int[] NOT NULL DEFAULT '{}'::int[];

ALTER TABLE items
  ADD CONSTRAINT items_seasonal_months_valid
  CHECK (seasonal_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]);

COMMENT ON COLUMN items.seasonal_months IS
  'Months (1=Jan..12=Dec) when this item is typically available. Used by /order/forecast to fill out the far-future zone where there is no concrete planting data yet.';

-- One-time seed: for each item, the months where it was delivered >= 2 times
-- in the past 12 months become its default seasonal_months.
-- Safe to re-run idempotently? The ALTER above will fail on second run
-- (column already exists), so the seed is effectively one-shot.

WITH item_months AS (
  SELECT
    di.item_id,
    EXTRACT(MONTH FROM d.delivery_date)::int AS month,
    COUNT(*) AS deliveries_in_month
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  WHERE d.delivery_date >= NOW() - INTERVAL '12 months'
    AND d.delivery_date < NOW()
  GROUP BY di.item_id, EXTRACT(MONTH FROM d.delivery_date)::int
  HAVING COUNT(*) >= 2
),
item_arrays AS (
  SELECT
    item_id,
    ARRAY_AGG(DISTINCT month ORDER BY month) AS months
  FROM item_months
  GROUP BY item_id
)
UPDATE items i
SET seasonal_months = ia.months
FROM item_arrays ia
WHERE i.id = ia.item_id;
