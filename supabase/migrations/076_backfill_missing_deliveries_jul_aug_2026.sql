-- 076_backfill_missing_deliveries_jul_aug_2026.sql
--
-- DATA FIX: restore deliveries missing from the finance system, Jul 11 – Aug 20 2026.
--
-- From ~2026-07-11 the order-day close-out shifted from the "Send to Receiver"
-- bar (which auto-materializes deliveries + delivery_items — the tables every
-- financial report reads) to the per-order "Mark Fulfilled" button, which only
-- flipped order status. Result: 12 (delivery_date, restaurant) pairs with
-- picked/fulfilled orders but NO deliveries row at all — ≈$3.9K of revenue
-- invisible to reports. The code fix (shared materializeDeliveryItems wired
-- into PATCH /api/orders/[orderId]) prevents recurrence; this migration
-- backfills the gap.
--
-- Logic mirrors src/lib/materialize-deliveries.ts exactly:
--   • resolved line = picked_at set OR is_shorted OR parent order 'fulfilled'
--   • qty = quantity_fulfilled for shorted lines, else quantity_requested
--   • unit = order line's unit, else first catalog unit, else 'ea';
--     dropped unless in the valid unit set
--   • price = unit_price_at_order → size_prices[size] → unit_prices[unit]
--     → default_price → 0
--   • lines merging to the same (item, unit, size, price) sum their
--     quantities (different varieties of one item are separate order lines
--     but one delivery line)
--
-- Scope guard: ONLY (date, restaurant) pairs with no deliveries row at all —
-- manually-logged dates (even under-logged ones) are left untouched, and
-- re-running is a no-op because the inserted rows defeat the NOT EXISTS.
-- deliveries.total_value fills itself via the update_delivery_total trigger.

BEGIN;

WITH lines AS (
  SELECT
    o.delivery_date,
    o.restaurant_id,
    i.id AS item_id,
    COALESCE(
      NULLIF(lower(btrim(oi.unit_type)), ''),
      NULLIF(lower(btrim(split_part(i.unit_type, ',', 1))), ''),
      'ea'
    ) AS unit,
    oi.size_label,
    CASE WHEN oi.is_shorted THEN COALESCE(oi.quantity_fulfilled, 0)
         ELSE COALESCE(oi.quantity_requested, 0) END AS qty,
    oi.unit_price_at_order,
    i.size_prices,
    i.unit_prices,
    i.default_price
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN availability_items ai ON ai.id = oi.availability_item_id
  JOIN items i ON i.id = ai.item_id
  WHERE o.delivery_date BETWEEN '2026-07-11' AND '2026-08-20'
    AND o.status IN ('fulfilled', 'in_progress')
    AND (oi.picked_at IS NOT NULL OR oi.is_shorted OR o.status = 'fulfilled')
    AND NOT EXISTS (
      SELECT 1 FROM deliveries d
      WHERE d.restaurant_id = o.restaurant_id
        AND d.delivery_date = o.delivery_date
    )
),
priced AS (
  SELECT
    delivery_date,
    restaurant_id,
    item_id,
    unit,
    size_label,
    qty,
    COALESCE(
      unit_price_at_order,
      CASE WHEN btrim(COALESCE(size_label, '')) <> ''
           THEN (size_prices ->> btrim(size_label))::numeric END,
      (unit_prices ->> unit)::numeric,
      default_price,
      0
    ) AS unit_price
  FROM lines
  WHERE qty > 0
    AND unit IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit', 'gb')
),
new_deliveries AS (
  INSERT INTO deliveries (delivery_date, restaurant_id, status, notes)
  SELECT DISTINCT
    delivery_date,
    restaurant_id,
    'logged',
    'Backfilled from picked/fulfilled orders (migration 076) — day was closed via Mark Fulfilled, which skipped delivery logging'
  FROM priced
  RETURNING id, delivery_date, restaurant_id
)
INSERT INTO delivery_items (delivery_id, item_id, quantity, unit, size_label, unit_price)
SELECT
  nd.id,
  p.item_id,
  SUM(p.qty),
  p.unit,
  p.size_label,
  p.unit_price
FROM priced p
JOIN new_deliveries nd
  ON nd.restaurant_id = p.restaurant_id
 AND nd.delivery_date = p.delivery_date
GROUP BY nd.id, p.item_id, p.unit, p.size_label, p.unit_price;

COMMIT;

-- Verification (run after):
--   SELECT d.delivery_date, r.name, d.total_value,
--          (SELECT count(*) FROM delivery_items di WHERE di.delivery_id = d.id) AS lines
--   FROM deliveries d JOIN restaurants r ON r.id = d.restaurant_id
--   WHERE d.notes LIKE 'Backfilled from picked/fulfilled orders (migration 076)%'
--   ORDER BY d.delivery_date;
--
-- Rollback (only if something looks wrong — deletes ONLY backfilled rows;
-- delivery_items cascade):
--   DELETE FROM deliveries
--   WHERE notes LIKE 'Backfilled from picked/fulfilled orders (migration 076)%';
