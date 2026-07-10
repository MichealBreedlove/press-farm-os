-- 072_variety_selection
-- Make an item's varieties (items.variety — already a comma-separated master
-- list, e.g. Basil: "Genovese, Thai, Cinnamon, Lemon") a selectable option
-- dimension, mirroring the existing sizes/colors pattern end-to-end:
--
--   1. availability_items.available_varieties — per-cycle admin override.
--      NULL = all master varieties available this cycle; a comma-separated
--      subset restricts what the chef can pick; "" = none (item is orderable
--      but exposes no variety choice). Same semantics as available_colors.
--   2. order_items.variety_key — comma-separated varieties the chef selected
--      for a line ("Genovese,Thai"). NULL when none. Same shape as color_key.
--   3. submit_order_with_items() — the chef-submit RPC inserts lines with an
--      explicit column list, so it must learn the new column. Body is
--      otherwise identical to the migration 070 version (same signature,
--      CREATE OR REPLACE); callers that omit variety_key in a line get NULL
--      from jsonb_to_recordset, so old deployed code keeps working.

ALTER TABLE availability_items ADD COLUMN IF NOT EXISTS available_varieties text;
COMMENT ON COLUMN availability_items.available_varieties IS
  'Per-cycle variety override: NULL = all of items.variety available; comma-separated subset restricts chef choice; empty string = no variety choice this cycle.';

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variety_key text;
COMMENT ON COLUMN order_items.variety_key IS
  'Comma-separated varieties the chef selected for this line ("Genovese,Thai"). NULL when none.';

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
      unit_price_at_order, unit_type, size_label, color_key, variety_key,
      menu_section, created_by
    )
    SELECT
      v_order_id, l.availability_item_id, l.quantity_requested,
      l.unit_price_at_order, l.unit_type, l.size_label, l.color_key, l.variety_key,
      l.menu_section, l.created_by
    FROM jsonb_to_recordset(p_lines) AS l(
      availability_item_id uuid,
      quantity_requested numeric,
      unit_price_at_order numeric,
      unit_type text,
      size_label text,
      color_key text,
      variety_key text,
      menu_section text,
      created_by uuid
    );
  END IF;

  RETURN v_order_id;
END;
$function$;
