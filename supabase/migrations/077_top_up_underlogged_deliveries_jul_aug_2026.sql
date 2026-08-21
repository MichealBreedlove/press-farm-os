-- 077_top_up_underlogged_deliveries_jul_aug_2026.sql
--
-- DATA FIX (companion to 076): mark the remaining Jul 11 – Aug 20 2026 order
-- days as fully picked & delivered, per Micheal 2026-08-21.
--
-- 076 recreated deliveries that were missing ENTIRELY. This migration handles
-- the other half: dates where a delivery was hand-logged but covers only part
-- of what was actually ordered and picked (e.g. 8/1 Press logged $202 of a
-- $1,050 day). Three steps, mirroring the app's own Mark Fulfilled semantics:
--
--   1. Auto-fill quantity_fulfilled = quantity_requested on non-shorted lines
--      still NULL (same as PATCH /api/orders/[orderId] does on fulfill).
--   2. Flip the window's lingering 'in_progress' orders to 'fulfilled'.
--   3. Top up existing non-finalized deliveries with order lines missing from
--      delivery_items, using the same unit/price precedence as
--      src/lib/materialize-deliveries.ts, with a STRICTER overlap guard:
--      skip a candidate when the delivery already holds ANY row for that
--      item+unit (any size) — hand-logged rows often used a different size
--      label (or a sibling variety item) for the same goods, e.g. the 8/8
--      Press tomato order was logged as "Tomatoes gb Medium" + "Cherry
--      Tomatoes gb", so inserting the order's size-less "Tomatoes gb" line
--      would double-count $300. Cross-ITEM overlaps (Tomatoes vs Cherry
--      Tomatoes as distinct catalog items) cannot be detected mechanically;
--      the one live case (8/8) is excluded by this guard via its same-item row.
--
-- Applied 2026-08-21 via the Supabase MCP. Dry-run verified: 13 deliveries,
-- 69 new lines, $2,548.70 added. Re-run is a no-op (the item+unit guard sees
-- the inserted rows). Touched deliveries get a notes marker; rollback = delete
-- delivery_items rows on deliveries whose notes contain '(migration 077)'
-- created at the migration timestamp — or restore per-delivery by hand.

BEGIN;

-- 1. Fill quantity_fulfilled (delivered in full unless explicitly shorted)
UPDATE order_items oi
SET quantity_fulfilled = oi.quantity_requested
FROM orders o
WHERE o.id = oi.order_id
  AND o.delivery_date BETWEEN '2026-07-11' AND '2026-08-20'
  AND o.status IN ('in_progress', 'fulfilled')
  AND oi.is_shorted = false
  AND oi.quantity_fulfilled IS NULL;

-- 2. Close out lingering in-progress orders in the window
UPDATE orders
SET status = 'fulfilled'
WHERE delivery_date BETWEEN '2026-07-11' AND '2026-08-20'
  AND status = 'in_progress';

-- 3. Top up under-logged deliveries
WITH cand AS (
  SELECT
    d.id AS delivery_id,
    i.id AS item_id,
    COALESCE(
      NULLIF(lower(btrim(oi.unit_type)), ''),
      NULLIF(lower(btrim(split_part(i.unit_type, ',', 1))), ''),
      'ea'
    ) AS unit,
    oi.size_label,
    CASE WHEN oi.is_shorted THEN COALESCE(oi.quantity_fulfilled, 0)
         ELSE COALESCE(oi.quantity_requested, 0) END AS qty,
    COALESCE(
      oi.unit_price_at_order,
      CASE WHEN btrim(COALESCE(oi.size_label, '')) <> ''
           THEN (i.size_prices ->> btrim(oi.size_label))::numeric END,
      (i.unit_prices ->> COALESCE(
        NULLIF(lower(btrim(oi.unit_type)), ''),
        NULLIF(lower(btrim(split_part(i.unit_type, ',', 1))), ''),
        'ea'))::numeric,
      i.default_price,
      0
    ) AS unit_price
  FROM orders o
  JOIN deliveries d
    ON d.restaurant_id = o.restaurant_id
   AND d.delivery_date = o.delivery_date
   AND d.status <> 'finalized'
  JOIN order_items oi ON oi.order_id = o.id
  JOIN availability_items ai ON ai.id = oi.availability_item_id
  JOIN items i ON i.id = ai.item_id
  WHERE o.delivery_date BETWEEN '2026-07-11' AND '2026-08-20'
    AND o.status = 'fulfilled'
),
merged AS (
  SELECT delivery_id, item_id, unit, size_label, unit_price, SUM(qty) AS qty
  FROM cand
  WHERE qty > 0
    AND unit IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit', 'gb')
  GROUP BY delivery_id, item_id, unit, size_label, unit_price
),
inserted AS (
  INSERT INTO delivery_items (delivery_id, item_id, quantity, unit, size_label, unit_price)
  SELECT m.delivery_id, m.item_id, m.qty, m.unit, m.size_label, m.unit_price
  FROM merged m
  WHERE NOT EXISTS (
    SELECT 1 FROM delivery_items di
    WHERE di.delivery_id = m.delivery_id
      AND di.item_id = m.item_id
      AND lower(di.unit) = m.unit
  )
  RETURNING delivery_id
)
UPDATE deliveries d
SET notes = COALESCE(d.notes || ' · ', '')
         || 'Topped up with unlogged order lines (migration 077)'
WHERE d.id IN (SELECT DISTINCT delivery_id FROM inserted)
  AND (d.notes IS NULL OR d.notes NOT LIKE '%(migration 077)%');

COMMIT;

-- Verification (run after):
--   SELECT d.delivery_date, r.name, d.total_value
--   FROM deliveries d JOIN restaurants r ON r.id = d.restaurant_id
--   WHERE d.notes LIKE '%(migration 077)%'
--   ORDER BY d.delivery_date;
