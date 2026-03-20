-- ============================================
-- Press Farm OS — Migration 005: Delivery Tracking
-- Tables: price_history, price_catalog, deliveries, delivery_items
-- RLS policies for new tables
-- ============================================

-- ============================================
-- price_history (audit trail)
-- ============================================
CREATE TABLE price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price decimal(10,2) NOT NULL,
  effective_date date NOT NULL,
  set_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_item ON price_history(item_id);
CREATE INDEX idx_price_history_date ON price_history(effective_date);

-- ============================================
-- price_catalog (KEY tab import target)
-- Authoritative price list — supports per-unit pricing
-- ============================================
CREATE TABLE price_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit text NOT NULL CHECK (unit IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit')),
  price_per_unit decimal(10,2) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'market' CHECK (source IN ('market', 'custom')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, unit, effective_date)
);

CREATE INDEX idx_price_catalog_item_unit ON price_catalog(item_id, unit);
CREATE INDEX idx_price_catalog_effective ON price_catalog(effective_date);

-- ============================================
-- deliveries (DELIVERY TRACKER replacement)
-- One row per delivery date per restaurant
-- ============================================
CREATE TABLE deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date date NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'logged', 'finalized')),
  total_value decimal(10,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(delivery_date, restaurant_id)
);

CREATE INDEX idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX idx_deliveries_restaurant ON deliveries(restaurant_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_restaurant_date ON deliveries(restaurant_id, delivery_date);

-- ============================================
-- delivery_items (line items per delivery)
-- Mirrors DELIVERY TRACKER columns: Date, Item, Qty, Unit, Price, Total
-- ============================================
CREATE TABLE delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id),
  quantity decimal(10,2) NOT NULL,
  unit text NOT NULL CHECK (unit IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit')),
  unit_price decimal(10,2) NOT NULL,
  line_total decimal(10,2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_item ON delivery_items(item_id);

-- Trigger: auto-update deliveries.total_value when delivery_items change
CREATE TRIGGER recalc_delivery_total
  AFTER INSERT OR UPDATE OR DELETE ON delivery_items
  FOR EACH ROW EXECUTE FUNCTION update_delivery_total();

-- updated_at triggers for new tables
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deliveries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS for new tables
-- ============================================
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;

-- Price history: admin only
CREATE POLICY "Admin can manage price history" ON price_history
  FOR ALL USING (is_admin());

-- Price catalog: all authenticated can read, admin manages
CREATE POLICY "Authenticated users can view price catalog" ON price_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage price catalog" ON price_catalog
  FOR ALL USING (is_admin());

-- Deliveries: admin only (chefs don't see delivery tracking)
CREATE POLICY "Admin can manage deliveries" ON deliveries
  FOR ALL USING (is_admin());

-- Delivery items: admin only
CREATE POLICY "Admin can manage delivery items" ON delivery_items
  FOR ALL USING (is_admin());
