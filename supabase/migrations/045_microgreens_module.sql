-- Migration 045: Microgreens production module
-- New /admin/microgreens module — variety library, demand, batches, trays, harvest events.
-- Linked to existing items via microgreen_crops.item_id.

-- Enum for tray status
CREATE TYPE microgreen_tray_status AS ENUM (
  'soaking', 'blackout', 'light', 'harvesting', 'terminated', 'lost'
);

-- 1. Variety library
CREATE TABLE microgreen_crops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  name text NOT NULL,
  variety text,
  seed_density_g_per_tray numeric NOT NULL CHECK (seed_density_g_per_tray > 0),
  presoak_hours int NOT NULL DEFAULT 0 CHECK (presoak_hours >= 0),
  presprout_hours int NOT NULL DEFAULT 0 CHECK (presprout_hours >= 0),
  bury_seed boolean NOT NULL DEFAULT false,
  weight_during_blackout boolean NOT NULL DEFAULT false,
  blackout_days int NOT NULL DEFAULT 0 CHECK (blackout_days >= 0),
  keep_in_blackout boolean NOT NULL DEFAULT false,
  ideal_harvest_day int NOT NULL CHECK (ideal_harvest_day > 0),
  harvest_min_days int,
  harvest_max_days int,
  expected_yield_oz_per_tray numeric NOT NULL CHECK (expected_yield_oz_per_tray > 0),
  is_continuous_harvest boolean NOT NULL DEFAULT false,
  productive_life_days int,
  growing_medium text[] NOT NULL DEFAULT '{soil}',
  preferred_medium text,
  tray_size text NOT NULL DEFAULT '10x20',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blackout_within_harvest CHECK (blackout_days <= ideal_harvest_day),
  CONSTRAINT productive_life_only_when_continuous
    CHECK ((is_continuous_harvest = false) OR (productive_life_days IS NOT NULL AND productive_life_days > 0))
);

-- 2. Weekly demand targets
CREATE TABLE microgreen_demand (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id uuid NOT NULL REFERENCES microgreen_crops(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  target_oz numeric NOT NULL CHECK (target_oz > 0),
  effective_from date,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX microgreen_demand_unique
  ON microgreen_demand (crop_id, COALESCE(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid), day_of_week, COALESCE(effective_from, '0001-01-01'::date));

-- 3. Sow batches
CREATE TABLE microgreen_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id uuid NOT NULL REFERENCES microgreen_crops(id) ON DELETE RESTRICT,
  sow_date date NOT NULL,
  soak_started_at timestamptz,
  planned_blackout_end date,
  planned_harvest_date date NOT NULL,
  tray_count int NOT NULL CHECK (tray_count > 0),
  seed_lot text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Individual trays
CREATE TABLE microgreen_trays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES microgreen_batches(id) ON DELETE CASCADE,
  tray_label text NOT NULL,
  status microgreen_tray_status NOT NULL,
  sow_date date NOT NULL,
  blackout_start date,
  light_start date,
  harvesting_start timestamptz,
  terminated_at timestamptz,
  lost_reason text,
  location text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lost_reason_required CHECK (status <> 'lost' OR lost_reason IS NOT NULL)
);

-- 5. Harvest events
CREATE TABLE microgreen_harvests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tray_id uuid NOT NULL REFERENCES microgreen_trays(id) ON DELETE CASCADE,
  harvested_at timestamptz NOT NULL DEFAULT now(),
  yield_oz numeric NOT NULL CHECK (yield_oz >= 0),
  unit text NOT NULL DEFAULT 'oz',
  delivery_id uuid REFERENCES deliveries(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_microgreen_trays_status ON microgreen_trays (status, sow_date);
CREATE INDEX idx_microgreen_batches_sow_date ON microgreen_batches (sow_date);
CREATE INDEX idx_microgreen_batches_harvest ON microgreen_batches (planned_harvest_date);
CREATE INDEX idx_microgreen_harvests_harvested_at ON microgreen_harvests (harvested_at);
CREATE INDEX idx_microgreen_harvests_tray ON microgreen_harvests (tray_id);
CREATE INDEX idx_microgreen_demand_lookup ON microgreen_demand (crop_id, day_of_week);

-- RLS — admin-only, matching the plantings pattern
ALTER TABLE microgreen_crops    ENABLE ROW LEVEL SECURITY;
ALTER TABLE microgreen_demand   ENABLE ROW LEVEL SECURITY;
ALTER TABLE microgreen_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE microgreen_trays    ENABLE ROW LEVEL SECURITY;
ALTER TABLE microgreen_harvests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to microgreen_crops"
  ON microgreen_crops    FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to microgreen_demand"
  ON microgreen_demand   FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to microgreen_batches"
  ON microgreen_batches  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to microgreen_trays"
  ON microgreen_trays    FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to microgreen_harvests"
  ON microgreen_harvests FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- updated_at triggers
CREATE TRIGGER update_microgreen_crops_updated_at
  BEFORE UPDATE ON microgreen_crops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_microgreen_demand_updated_at
  BEFORE UPDATE ON microgreen_demand
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_microgreen_trays_updated_at
  BEFORE UPDATE ON microgreen_trays
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
