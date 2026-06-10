-- Migration 066: atomic order submission
--
-- POST /api/orders previously ran its writes as separate statements:
--   1. upsert orders row (status → 'submitted', notes, accountability stamps)
--   2. then order_items writes (replace mode: delete + insert; merge mode:
--      per-line quantity updates + insert of unmatched lines)
-- A failure between steps left the order updated with stale/empty items, and
-- a concurrent admin "Finish & Send" could move the order out of a
-- chef-editable status between the route's JS status check and the upsert.
--
-- submit_order_with_items() wraps all of it in one transaction. The route
-- still does validation, price resolution, and merge *planning* in JS (the
-- unit-tested planOrderItemMerge); this function only applies the planned
-- writes atomically.
--
-- SECURITY INVOKER on purpose: the route calls this through the user-scoped
-- client, so the chef's RLS policies (user_restaurant_ids()) keep applying to
-- every statement inside — same security model as the previous inline writes.

CREATE OR REPLACE FUNCTION public.submit_order_with_items(
  p_restaurant_id uuid,
  p_delivery_date date,
  p_freeform_notes text,
  p_chef_id uuid,
  p_last_edited_by uuid,
  p_replace boolean,
  p_lines jsonb DEFAULT '[]'::jsonb,
  p_update_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_now timestamptz := now();
BEGIN
  -- Upsert the order. The ON CONFLICT ... WHERE clause re-checks the
  -- chef-editable statuses INSIDE the transaction: if admin moved the order
  -- to in_progress/fulfilled/cancelled after the route's pre-check, the
  -- update is skipped and we abort instead of overwriting.
  INSERT INTO orders (
    restaurant_id, delivery_date, status, freeform_notes,
    submitted_at, chef_id, last_edited_by, last_edited_at
  )
  VALUES (
    p_restaurant_id, p_delivery_date, 'submitted', p_freeform_notes,
    v_now, p_chef_id, p_last_edited_by, v_now
  )
  ON CONFLICT (restaurant_id, delivery_date) DO UPDATE
    SET status = 'submitted',
        freeform_notes = EXCLUDED.freeform_notes,
        submitted_at = EXCLUDED.submitted_at,
        -- preserve the original creator; accountability lives in last_edited_*
        chef_id = orders.chef_id,
        last_edited_by = EXCLUDED.last_edited_by,
        last_edited_at = EXCLUDED.last_edited_at
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

-- Same grant hygiene as migrations 043/064: callable by signed-in users only.
REVOKE EXECUTE ON FUNCTION public.submit_order_with_items(uuid, date, text, uuid, uuid, boolean, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_order_with_items(uuid, date, text, uuid, uuid, boolean, jsonb, jsonb) TO authenticated, service_role;
