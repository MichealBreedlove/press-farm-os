-- Migration 069: Production value tracking
--
-- A SEPARATE revenue stream for self-harvested crops that chefs pick on their
-- own (no order, no delivery_items row). Two sources:
--   1. Microgreen trays — each crop carries a flat value_per_tray (e.g.
--      nasturtium $1000), accrued evenly day-by-day over the crop's productive
--      life from when the tray enters 'harvesting' until terminated, capped at
--      value_per_tray.
--   2. Planter boxes — a new module: boxes hold plantings (flowers/herbs), each
--      with a lifecycle that drives how its value accrues over time.
--
-- This value NEVER touches delivery_items, so chef order/delivery reports stay
-- clean. It is computed on the fly (no stored daily rows, no cron) by the
-- accrual lib in src/lib/production-value/ and surfaced on its own report plus
-- rolled into the executive top-line. Default 75/25 Press/Under-Study split
-- lives in farm_settings (see bottom) with a code-level fallback.

-- ── 1. Microgreen tray value ────────────────────────────────────────────────
ALTER TABLE microgreen_crops
  ADD COLUMN value_per_tray numeric
    CHECK (value_per_tray IS NULL OR value_per_tray >= 0);

COMMENT ON COLUMN microgreen_crops.value_per_tray IS
  'Flat production value of one tray of this crop, accrued evenly across the '
  'crop''s productive_life_days from harvesting_start until terminated (capped '
  'at this amount). NULL = not tracked for production value. Requires '
  'productive_life_days to be set (continuous-harvest crops).';

-- ── 2. Planter-box module ───────────────────────────────────────────────────
-- annual              → value_amount is a TOTAL spread evenly over planted_date..end_date
-- perennial_evergreen → value_amount is a MONTHLY rate, accrues every day while active (rosemary)
-- perennial_dormant   → value_amount is a MONTHLY rate, accrues only in seasonal_months (verbena)
CREATE TYPE planting_lifecycle AS ENUM (
  'annual', 'perennial_evergreen', 'perennial_dormant'
);

CREATE TABLE planter_boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text,
  size text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE planter_box_plantings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL REFERENCES planter_boxes(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  name text NOT NULL,
  lifecycle planting_lifecycle NOT NULL,
  planted_date date NOT NULL,
  -- annual: required end of the producing window. perennials: NULL while active;
  -- set to the removal date once the planting is pulled.
  end_date date,
  -- annual → total value; perennials → monthly value
  value_amount numeric NOT NULL CHECK (value_amount >= 0),
  value_basis text NOT NULL CHECK (value_basis IN ('total', 'monthly')),
  -- perennial_dormant only: months (1=Jan..12=Dec) the planting actively produces
  seasonal_months int[] NOT NULL DEFAULT '{}'::int[]
    CHECK (seasonal_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT annual_needs_end
    CHECK (lifecycle <> 'annual' OR end_date IS NOT NULL),
  CONSTRAINT annual_uses_total
    CHECK (lifecycle <> 'annual' OR value_basis = 'total'),
  CONSTRAINT perennial_uses_monthly
    CHECK (lifecycle = 'annual' OR value_basis = 'monthly'),
  CONSTRAINT dormant_needs_months
    CHECK (lifecycle <> 'perennial_dormant' OR cardinality(seasonal_months) > 0),
  CONSTRAINT end_after_start
    CHECK (end_date IS NULL OR end_date >= planted_date)
);

-- Optional activity / harvest log (notes only — never revenue).
CREATE TABLE planter_box_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL REFERENCES planter_boxes(id) ON DELETE CASCADE,
  planting_id uuid REFERENCES planter_box_plantings(id) ON DELETE SET NULL,
  logged_at date NOT NULL DEFAULT CURRENT_DATE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_planter_box_plantings_box ON planter_box_plantings (box_id);
CREATE INDEX idx_planter_box_activity_box ON planter_box_activity (box_id, logged_at);

-- RLS — admin-only, matching the microgreens module (migration 045).
ALTER TABLE planter_boxes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE planter_box_plantings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE planter_box_activity   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to planter_boxes"
  ON planter_boxes         FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "Admin full access to planter_box_plantings"
  ON planter_box_plantings FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());
CREATE POLICY "Admin full access to planter_box_activity"
  ON planter_box_activity  FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TRIGGER update_planter_boxes_updated_at
  BEFORE UPDATE ON planter_boxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_planter_box_plantings_updated_at
  BEFORE UPDATE ON planter_box_plantings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── 3. Production-value restaurant split (global default) ────────────────────
-- Adjustable without a deploy; src/lib/production-value/accrual.ts falls back to
-- 0.75 / 0.25 if these rows are absent.
INSERT INTO farm_settings (farm_id, key, value)
SELECT id, 'production_split_press', '0.75' FROM farms
ON CONFLICT (farm_id, key) DO NOTHING;
INSERT INTO farm_settings (farm_id, key, value)
SELECT id, 'production_split_understudy', '0.25' FROM farms
ON CONFLICT (farm_id, key) DO NOTHING;
