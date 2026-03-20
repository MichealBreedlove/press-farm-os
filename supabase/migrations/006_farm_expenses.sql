-- ============================================
-- Press Farm OS — Migration 006: Farm Expenses
-- Table: farm_expenses
-- Source: Farm Expenses tab in Daily Delivery Tracking Sheet
-- ============================================

CREATE TABLE farm_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  date date NOT NULL,
  category text NOT NULL,
  description text,
  amount decimal(10,2) NOT NULL,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_farm_expenses_date ON farm_expenses(date);
CREATE INDEX idx_farm_expenses_farm ON farm_expenses(farm_id);
CREATE INDEX idx_farm_expenses_category ON farm_expenses(category);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON farm_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE farm_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage farm expenses" ON farm_expenses
  FOR ALL USING (is_admin());
