-- Migration 046: Seed inventory
-- New tables: seeds, seed_sowings, seed_germination_tests
-- New view: seeds_with_on_hand (computes on_hand and is_low from sowings)
-- Adds optional plantings.seed_id FK

CREATE TABLE IF NOT EXISTS seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  variety text NOT NULL,
  initial_quantity decimal(10,2) NOT NULL,
  quantity_unit text NOT NULL,
  packed_for_year integer,
  purchase_date date,
  supplier text,
  cost decimal(10,2),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'low', 'exhausted', 'discarded')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seed_sowings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id uuid NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  planting_id uuid REFERENCES plantings(id) ON DELETE SET NULL,
  amount_used decimal(10,2) NOT NULL,
  sown_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seed_germination_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id uuid NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  tested_on date NOT NULL DEFAULT CURRENT_DATE,
  germination_pct decimal(5,2) NOT NULL CHECK (germination_pct >= 0 AND germination_pct <= 100),
  seeds_tested integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE plantings ADD COLUMN IF NOT EXISTS seed_id uuid REFERENCES seeds(id) ON DELETE SET NULL;

CREATE OR REPLACE VIEW seeds_with_on_hand AS
SELECT
  s.id,
  s.farm_id,
  s.item_id,
  s.variety,
  s.initial_quantity,
  s.quantity_unit,
  s.packed_for_year,
  s.purchase_date,
  s.supplier,
  s.cost,
  s.status,
  s.notes,
  s.created_at,
  s.updated_at,
  (s.initial_quantity - COALESCE(SUM(sw.amount_used), 0)) AS on_hand,
  CASE
    WHEN s.initial_quantity > 0
      AND (s.initial_quantity - COALESCE(SUM(sw.amount_used), 0))
          <= s.initial_quantity * 0.20
    THEN true
    ELSE false
  END AS is_low,
  MAX(sw.sown_on) AS last_sown_on,
  (SELECT germination_pct FROM seed_germination_tests gt
    WHERE gt.seed_id = s.id ORDER BY tested_on DESC LIMIT 1) AS latest_germ_pct,
  (SELECT tested_on FROM seed_germination_tests gt
    WHERE gt.seed_id = s.id ORDER BY tested_on DESC LIMIT 1) AS latest_germ_tested_on
FROM seeds s
LEFT JOIN seed_sowings sw ON sw.seed_id = s.id
GROUP BY s.id;

ALTER TABLE seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_sowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_germination_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to seeds"
  ON seeds FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "Admin full access to seed_sowings"
  ON seed_sowings FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "Admin full access to seed_germination_tests"
  ON seed_germination_tests FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TRIGGER update_seeds_updated_at
  BEFORE UPDATE ON seeds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_seeds_item ON seeds (item_id);
CREATE INDEX IF NOT EXISTS idx_seeds_status ON seeds (status);
CREATE INDEX IF NOT EXISTS idx_seed_sowings_seed ON seed_sowings (seed_id);
CREATE INDEX IF NOT EXISTS idx_seed_sowings_planting ON seed_sowings (planting_id);
CREATE INDEX IF NOT EXISTS idx_seed_germ_tests_seed ON seed_germination_tests (seed_id);
