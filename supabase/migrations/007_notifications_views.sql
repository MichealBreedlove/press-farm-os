-- ============================================
-- Press Farm OS — Migration 007: Notifications + Financial View
-- Table: notifications
-- View: financial_periods
-- ============================================

-- ============================================
-- notifications (audit log of all emails sent)
-- ============================================
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN (
    'order_submitted',
    'order_confirmed',
    'shortage',
    'fulfilled',
    'availability_published'
  )),
  recipient_id uuid NOT NULL REFERENCES profiles(id),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  subject text,
  body_preview text,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_order ON notifications(order_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_sent_at ON notifications(sent_at);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (recipient_id = auth.uid() OR is_admin());

CREATE POLICY "Admin can manage notifications" ON notifications
  FOR ALL USING (is_admin());

-- ============================================
-- financial_periods VIEW
-- Monthly rollup of delivery values + expenses
-- Used by the Reports dashboard
-- Benchmark: Q1 2026 = $21,633 value / $1,536 expenses / $12K farmer pay
-- ============================================
CREATE OR REPLACE VIEW financial_periods AS
SELECT
  date_trunc('month', d.delivery_date) AS period_start,
  'monthly'::text AS period_type,
  d.restaurant_id,
  r.name AS restaurant_name,
  COALESCE(SUM(d.total_value), 0) AS total_delivery_value,
  (
    SELECT COALESCE(SUM(fe.amount), 0)
    FROM farm_expenses fe
    WHERE date_trunc('month', fe.date) = date_trunc('month', d.delivery_date)
  ) AS total_expenses,
  COUNT(DISTINCT d.delivery_date) AS delivery_count
FROM deliveries d
JOIN restaurants r ON r.id = d.restaurant_id
WHERE d.status = 'finalized'
GROUP BY date_trunc('month', d.delivery_date), d.restaurant_id, r.name;

-- ============================================
-- most_ordered_items VIEW
-- Aggregate of order_items for the Most Ordered analysis
-- ============================================
CREATE OR REPLACE VIEW most_ordered_items AS
SELECT
  i.id AS item_id,
  i.name AS item_name,
  i.category,
  i.unit_type,
  COUNT(DISTINCT oi.order_id) AS order_frequency,
  SUM(oi.quantity_requested) AS total_quantity_requested,
  SUM(COALESCE(oi.quantity_fulfilled, oi.quantity_requested)) AS total_quantity_fulfilled,
  SUM(
    COALESCE(oi.quantity_fulfilled, oi.quantity_requested)
    * COALESCE(oi.unit_price_at_order, 0)
  ) AS total_value
FROM order_items oi
JOIN availability_items ai ON ai.id = oi.availability_item_id
JOIN items i ON i.id = ai.item_id
JOIN orders o ON o.id = oi.order_id
WHERE o.status IN ('fulfilled', 'in_progress')
GROUP BY i.id, i.name, i.category, i.unit_type;
