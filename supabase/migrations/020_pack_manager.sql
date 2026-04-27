-- 020: Pack Manager — track container inventory
CREATE TABLE IF NOT EXISTS pack_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  container_type text NOT NULL UNIQUE,
  display_name text NOT NULL,
  on_hand integer NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reorder_threshold integer NOT NULL DEFAULT 10,
  unit_cost decimal(6,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pack_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY pack_inventory_admin_all ON pack_inventory
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_pack_inventory_updated_at
  BEFORE UPDATE ON pack_inventory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Seed defaults — matches container types from harvest list
INSERT INTO pack_inventory (farm_id, container_type, display_name, on_hand, reorder_threshold)
SELECT id, 'lg', 'Large To-Go', 0, 20 FROM farms LIMIT 1
ON CONFLICT (container_type) DO NOTHING;

INSERT INTO pack_inventory (farm_id, container_type, display_name, on_hand, reorder_threshold)
SELECT id, 'sm', 'Small To-Go', 0, 20 FROM farms LIMIT 1
ON CONFLICT (container_type) DO NOTHING;

INSERT INTO pack_inventory (farm_id, container_type, display_name, on_hand, reorder_threshold)
SELECT id, 'qt', 'Quart', 0, 10 FROM farms LIMIT 1
ON CONFLICT (container_type) DO NOTHING;

INSERT INTO pack_inventory (farm_id, container_type, display_name, on_hand, reorder_threshold)
SELECT id, 'bx', 'Box', 0, 5 FROM farms LIMIT 1
ON CONFLICT (container_type) DO NOTHING;

INSERT INTO pack_inventory (farm_id, container_type, display_name, on_hand, reorder_threshold)
SELECT id, 'lbs', 'Green Bin', 0, 5 FROM farms LIMIT 1
ON CONFLICT (container_type) DO NOTHING;
