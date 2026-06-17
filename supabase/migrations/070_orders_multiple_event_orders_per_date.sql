-- 070_orders_multiple_event_orders_per_date
-- The Events team can place MULTIPLE orders for the same delivery date (two
-- different events that both deliver on the same day are separate orders).
-- Chef orders stay one-per-(restaurant, delivery_date) — "last save wins".
--
-- Distinguish the two by orders.event_date: chef orders have it NULL, Events
-- orders always set it (migration 069). So the uniqueness becomes PARTIAL —
-- enforced only for non-event orders.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_restaurant_id_delivery_date_key;
DROP INDEX IF EXISTS orders_restaurant_id_delivery_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS orders_restaurant_delivery_non_event_uniq
  ON orders (restaurant_id, delivery_date)
  WHERE event_date IS NULL;

-- The chef submit RPC upserts on (restaurant_id, delivery_date). Its arbiter
-- must now name the partial index's predicate. Chef inserts never set
-- event_date, so they always match WHERE event_date IS NULL. Body is otherwise
-- identical to the migration 068 version.
CREATE OR REPLACE FUNCTION public.submit_order_with_items(
  p_restaurant_id uuid,
  p_delivery_date date,
  p_freeform_notes text,
  p_chef_id uuid,
  p_last_edited_by uuid,
  p_replace boolean,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_update_lines jsonb DEFAULT '[]'::jsonb,
  p_idempotency_key text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid;
  v_now timestamptz := now();
  v_existing_token text;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, last_submission_token
      INTO v_order_id, v_existing_token
      FROM orders
      WHERE restaurant_id = p_restaurant_id
        AND delivery_date = p_delivery_date
        AND event_date IS NULL
      FOR UPDATE;
    IF FOUND AND v_existing_token IS NOT DISTINCT FROM p_idempotency_key THEN
      RETURN v_order_id;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM delivery_dates
    WHERE date = p_delivery_date
      AND ordering_open = true
  ) THEN
    RAISE EXCEPTION 'ORDERING_CLOSED'
      USING HINT = 'Ordering closed for this delivery date';
  END IF;

  INSERT INTO orders (
    restaurant_id, delivery_date, status, freeform_notes,
    submitted_at, chef_id, last_edited_by, last_edited_at, last_submission_token
  )
  VALUES (
    p_restaurant_id, p_delivery_date, 'submitted', p_freeform_notes,
    v_now, p_chef_id, p_last_edited_by, v_now, p_idempotency_key
  )
  ON CONFLICT (restaurant_id, delivery_date) WHERE event_date IS NULL DO UPDATE
    SET status = 'submitted',
        freeform_notes = EXCLUDED.freeform_notes,
        submitted_at = COALESCE(orders.submitted_at, EXCLUDED.submitted_at),
        chef_id = orders.chef_id,
        last_edited_by = EXCLUDED.last_edited_by,
        last_edited_at = EXCLUDED.last_edited_at,
        last_submission_token = EXCLUDED.last_submission_token
    WHERE orders.status IN ('draft', 'submitted')
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_LOCKED'
      USING HINT = 'Order has moved past a chef-editable status';
  END IF;

  IF p_replace THEN
    DELETE FROM order_items WHERE order_id = v_order_id;
  END IF;

  IF p_update_lines IS NOT NULL AND jsonb_array_length(p_update_lines) > 0 THEN
    UPDATE order_items oi
    SET quantity_requested = u.quantity_requested
    FROM jsonb_to_recordset(p_update_lines)
      AS u(id uuid, quantity_requested numeric)
    WHERE oi.id = u.id
      AND oi.order_id = v_order_id;
  END IF;

  IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
    INSERT INTO order_items (
      order_id, availability_item_id, quantity_requested,
      unit_price_at_order, unit_type, size_label, color_key,
      menu_section, created_by
    )
    SELECT
      v_order_id, l.availability_item_id, l.quantity_requested,
      l.unit_price_at_order, l.unit_type, l.size_label, l.color_key,
      l.menu_section, l.created_by
    FROM jsonb_to_recordset(p_lines) AS l(
      availability_item_id uuid,
      quantity_requested numeric,
      unit_price_at_order numeric,
      unit_type text,
      size_label text,
      color_key text,
      menu_section text,
      created_by uuid
    );
  END IF;

  RETURN v_order_id;
END;
$function$;
