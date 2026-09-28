-- 080_order_item_notes
-- Per-line chef notes. The chef order form has always shown an "Add a note..."
-- field on every item row, but the value was never persisted: order_items had
-- no column for it and the review page dropped it from the submit payload, so
-- chefs' per-item instructions silently vanished before reaching the farm.
--
--   1. order_items.notes — free-text note the chef typed on this line.
--   2. submit_order_with_items() — inserts `notes` from p_lines, and a merge
--      update (p_update_lines) may carry a combined note; a NULL/absent note
--      keeps the stored one. Same signature as 072 (CREATE OR REPLACE);
--      callers that omit `notes` get NULL from jsonb_to_recordset, so already
--      deployed code keeps working unchanged.

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes text;
COMMENT ON COLUMN order_items.notes IS
  'Free-text note the chef typed on this order line ("extra small please"). NULL when none.';

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
    SET quantity_requested = u.quantity_requested,
        notes = COALESCE(u.notes, oi.notes)
    FROM jsonb_to_recordset(p_update_lines)
      AS u(id uuid, quantity_requested numeric, notes text)
    WHERE oi.id = u.id
      AND oi.order_id = v_order_id;
  END IF;

  IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
    INSERT INTO order_items (
      order_id, availability_item_id, quantity_requested,
      unit_price_at_order, unit_type, size_label, color_key, variety_key,
      menu_section, created_by, notes
    )
    SELECT
      v_order_id, l.availability_item_id, l.quantity_requested,
      l.unit_price_at_order, l.unit_type, l.size_label, l.color_key, l.variety_key,
      l.menu_section, l.created_by, l.notes
    FROM jsonb_to_recordset(p_lines) AS l(
      availability_item_id uuid,
      quantity_requested numeric,
      unit_price_at_order numeric,
      unit_type text,
      size_label text,
      color_key text,
      variety_key text,
      menu_section text,
      created_by uuid,
      notes text
    );
  END IF;

  RETURN v_order_id;
END;
$function$;
