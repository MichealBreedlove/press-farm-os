-- 094 — DATA FIX: spread four bulk delivery lines across the harvests they
-- actually came from.
--
-- Micheal (2026-10-25): these lines are real, but each one logged several
-- earlier, unrecorded harvests on a single date. Spread each line's quantity
-- evenly across that restaurant's deliveries from 28 days before through the
-- logged date (inclusive). Whole units only; the remainder goes one-per-date
-- to the latest dates. Unit, price, size label and bonus flag are copied, so
-- every line's total quantity and dollar value are unchanged.
--
--   Carrots           Press        2026-01-25  3,000 ea × $3.50  = $10,500.00  → 14 dates (2 fall in Dec 2025)
--   Turnip - Leaves   Press        2025-11-07    100 lg × $25.00 =  $2,500.00  → 17 dates
--   Patty Pan Squash  Press        2026-08-10     25 ea × $25.00 =    $625.00  → 13 dates
--   Turnip            Under-Study  2026-05-23  2,000 ea × $0.50  =  $1,000.00  →  6 dates
--
-- The source line keeps its share; new lines go on the other window dates.
-- deliveries.total_value follows via the recalc_delivery_total trigger.
-- Touched deliveries get a '(migration 094)' notes marker.
--
-- Idempotent: a source line is matched by its ORIGINAL quantity, so once it
-- has been reduced to its share a re-run finds nothing to do.
--
-- Rollback: delete delivery_items whose delivery notes carry the 094 marker
-- and that were created by this migration (created_at = the apply time), then
-- restore each source line's quantity to the original above.

DO $$
DECLARE
  src  RECORD;
  tgt  RECORD;
  n    int;
  base numeric;
  rem  int;
  i    int;
  share numeric;
BEGIN
  FOR src IN
    SELECT di.id AS line_id, di.item_id, di.unit, di.unit_price, di.quantity,
           di.size_label, di.is_bonus, d.id AS delivery_id, d.restaurant_id, d.delivery_date
      FROM delivery_items di
      JOIN deliveries d ON d.id = di.delivery_id
      JOIN items it     ON it.id = di.item_id
     WHERE (d.delivery_date = '2026-01-25' AND it.name = 'Carrots'          AND di.unit = 'ea' AND di.quantity = 3000)
        OR (d.delivery_date = '2025-11-07' AND it.name = 'Turnip - Leaves'  AND di.unit = 'lg' AND di.quantity = 100)
        OR (d.delivery_date = '2026-08-10' AND it.name = 'Patty Pan Squash' AND di.unit = 'ea' AND di.quantity = 25)
        OR (d.delivery_date = '2026-05-23' AND it.name = 'Turnip'           AND di.unit = 'ea' AND di.quantity = 2000)
  LOOP
    SELECT count(*) INTO n
      FROM deliveries
     WHERE restaurant_id = src.restaurant_id
       AND delivery_date BETWEEN src.delivery_date - 28 AND src.delivery_date;

    IF n <= 1 THEN
      CONTINUE;
    END IF;

    base := floor(src.quantity / n);
    rem  := (src.quantity - base * n)::int;
    i    := 0;

    -- Oldest first; the last `rem` dates get one extra unit.
    FOR tgt IN
      SELECT id, delivery_date
        FROM deliveries
       WHERE restaurant_id = src.restaurant_id
         AND delivery_date BETWEEN src.delivery_date - 28 AND src.delivery_date
       ORDER BY delivery_date, id
    LOOP
      i := i + 1;
      share := base + CASE WHEN i > n - rem THEN 1 ELSE 0 END;

      IF tgt.id = src.delivery_id THEN
        UPDATE delivery_items SET quantity = share WHERE id = src.line_id;
      ELSIF share > 0 THEN
        INSERT INTO delivery_items (delivery_id, item_id, quantity, unit, unit_price, size_label, is_bonus)
        VALUES (tgt.id, src.item_id, share, src.unit, src.unit_price, src.size_label, src.is_bonus);
      END IF;

      UPDATE deliveries
         SET notes = concat_ws(' ', nullif(notes, ''),
                               '(migration 094: spread bulk harvest line from ' || src.delivery_date || ')')
       WHERE id = tgt.id
         AND coalesce(notes, '') NOT LIKE '%migration 094: spread bulk harvest line from ' || src.delivery_date || '%';
    END LOOP;
  END LOOP;
END $$;
