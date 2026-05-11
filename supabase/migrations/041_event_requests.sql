-- ============================================
-- Press Farm OS — Migration 041: Event Requests
-- ============================================
-- Lets chefs flag items they'll need for upcoming events before the
-- corresponding delivery date has availability published. Admin
-- reviews on /admin/event-requests; accepting auto-creates a
-- delivery_date (if missing), availability_items row, an order, and
-- an order_items line. See /api/event-requests/[id] for the
-- accept-flow implementation.

CREATE TABLE event_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  chef_id         uuid NOT NULL REFERENCES profiles(id),
  item_id         uuid NOT NULL REFERENCES items(id),
  quantity        numeric NOT NULL CHECK (quantity > 0),
  unit            text NOT NULL,
  needed_by_date  date NOT NULL,
  event_name      text,
  notes           text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','accepted','declined','fulfilled')),
  admin_response  text,
  responded_at    timestamptz,
  responded_by    uuid REFERENCES profiles(id),
  order_item_id   uuid REFERENCES order_items(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_requests_status         ON event_requests(status);
CREATE INDEX idx_event_requests_restaurant     ON event_requests(restaurant_id);
CREATE INDEX idx_event_requests_needed_by_date ON event_requests(needed_by_date);

-- updated_at trigger (reuses helper from migration 003)
CREATE TRIGGER trg_event_requests_updated_at
  BEFORE UPDATE ON event_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE event_requests ENABLE ROW LEVEL SECURITY;

-- Chefs see + create requests for their own restaurant; admin sees all.
CREATE POLICY "Restaurant users view own event requests" ON event_requests
  FOR SELECT USING (
    is_admin()
    OR restaurant_id IN (SELECT user_restaurant_ids())
  );

CREATE POLICY "Restaurant users create event requests" ON event_requests
  FOR INSERT WITH CHECK (
    is_admin()
    OR (
      chef_id = auth.uid()
      AND restaurant_id IN (SELECT user_restaurant_ids())
    )
  );

-- Only admin can update/delete (chef can't modify a request once filed —
-- they'd file a new one or contact the farm).
CREATE POLICY "Admin manages event requests" ON event_requests
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admin deletes event requests" ON event_requests
  FOR DELETE USING (is_admin());

COMMENT ON TABLE event_requests IS
  'Advance item requests filed by chefs ahead of events. Distinct from regular orders: requests can target any future date and any catalog item, not just published availability. Accepted requests get linked to an auto-created order_items row via order_item_id.';
