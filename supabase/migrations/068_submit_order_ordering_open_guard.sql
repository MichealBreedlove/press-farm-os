-- Migration 068: re-check ordering_open inside the submit transaction (F-5)
--
-- POST /api/orders checks delivery_dates.ordering_open in JS before calling
-- submit_order_with_items(). That leaves a TOCTOU window: an admin closing the
-- date between the route's pre-check and the write could still let a
-- submission land on a closed date. We close the race the same way the
-- chef-editable status race was closed in 066 — re-check inside the
-- transaction and abort.
--
-- The idempotency short-circuit stays ABOVE the guard: a retry of a submission
-- that already committed must still report success even if the date has since
-- closed (same reasoning as the status-lock idempotency path).
--
-- Signature is unchanged from 067, so CREATE OR REPLACE suffices (no DROP /
-- re-GRANT needed — privileges carry over).

CREATE OR REPLACE FUNCTION public.submit_order_with_items(
  p_restaurant_id uuid,
  p_delivery_date date,
  p_freeform_notes text,
  p_chef_id uuid,
  p_last_edited_by uuid,
  p_replace boolean,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_update_lines jsonb DEFAULT '[]'::jsonb,
  p_idempotency_key text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_now timestamptz := now();
  v_existing_token text;
BEGIN
  -- Idempotency short-circuit (defense-in-depth — the route also checks).
  -- FOR UPDATE serializes concurrent retries; a matching token means the
  -- original write committed, so return its id without re-applying writes.
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, last_submission_token
      INTO v_order_id, v_existing_token
      FROM orders
      WHERE restaurant_id = p_restaurant_id
        AND delivery_date = p_delivery_date
      FOR UPDATE;
    IF FOUND AND v_existing_token IS NOT DISTINCT FROM p_idempotency_key THEN
      RETURN v_order_id;
    END IF;
  END IF;

  -- Re-check ordering_open in-transaction. A missing delivery_dates row or a
  -- closed one both abort. (The route already gives a friendly pre-check; this
  -- only catches the concurrent-close race.)
  IF NOT EXISTS (
    SELECT 1 FROM delivery_dates
    WHERE date = p_delivery_date
      AND ordering_open = true
  ) THEN
    RAISE EXCEPTION 'ORDERING_CLOSED'
      USING HINT = 'Ordering closed for this delivery date';
  END IF;

  -- Upsert the order. The ON CONFLICT ... WHERE clause re-checks the
  -- chef-editable statuses INSIDE the transaction: if admin moved the order
  -- to in_progress/fulfilled/cancelled after the route's pre-check, the
  -- update is skipped and we abort instead of overwriting.
  INSERT INTO orders (
    restaurant_id, delivery_date, status, freeform_notes,
    submitted_at, chef_id, last_edited_by, last_edited_at, last_submission_token
  )
  VALUES (
    p_restaurant_id, p_delivery_date, 'submitted', p_freeform_notes,
    v_now, p_chef_id, p_last_edited_by, v_now, p_idempotency_key
  )
  ON CONFLICT (restaurant_id, delivery_date) DO UPDATE
    SET status = 'submitted',
        freeform_notes = EXCLUDED.freeform_notes,
        -- preserve the ORIGINAL submission time; edits live in last_edited_*
        submitted_at = COALESCE(orders.submitted_at, EXCLUDED.submitted_at),
        -- preserve the original creator; accountability lives in last_edited_*
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

  -- Merge mode: bump quantities on matched existing lines.
  IF p_update_lines IS NOT NULL AND jsonb_array_length(p_update_lines) > 0 THEN
    UPDATE order_items oi
    SET quantity_requested = u.quantity_requested
    FROM jsonb_to_recordset(p_update_lines)
      AS u(id uuid, quantity_requested numeric)
    WHERE oi.id = u.id
      AND oi.order_id = v_order_id;
  END IF;

  -- New lines (replace mode: all lines; merge mode: unmatched lines).
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
$$;
