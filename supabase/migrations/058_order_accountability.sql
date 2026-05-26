-- 058_order_accountability.sql
-- Individual-account accountability: track who placed an order, who last
-- edited it, who added each line, and a full append-only audit trail of every
-- order action (submit / edit / shortage / status change). This supports the
-- move from shared restaurant logins back to individual chef accounts.

-- Order-level edit tracking. chef_id already records the original creator;
-- these record the most recent editor.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz;

-- Per-line authorship (who added this specific line on the most recent write).
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id);

-- Append-only audit log. actor_name is a denormalized snapshot so the history
-- stays readable even if a profile is renamed or deactivated later.
CREATE TABLE IF NOT EXISTS order_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id),
  delivery_date date,
  actor_id uuid REFERENCES profiles(id),
  actor_name text,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_audit_order ON order_audit(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_audit_restaurant_date ON order_audit(restaurant_id, delivery_date);

ALTER TABLE order_audit ENABLE ROW LEVEL SECURITY;

-- Chefs see audit rows for their own restaurant(s); admin + receiver see all.
DROP POLICY IF EXISTS order_audit_select ON order_audit;
CREATE POLICY order_audit_select ON order_audit
  FOR SELECT USING (
    private.is_admin()
    OR private.is_receiver()
    OR (restaurant_id IN (SELECT private.user_restaurant_ids()))
  );

-- Chefs may insert audit rows scoped to their restaurant (their own actions);
-- admin can insert anything. Server routes using the service role bypass RLS.
DROP POLICY IF EXISTS order_audit_insert ON order_audit;
CREATE POLICY order_audit_insert ON order_audit
  FOR INSERT WITH CHECK (
    private.is_admin()
    OR (restaurant_id IN (SELECT private.user_restaurant_ids()))
  );
