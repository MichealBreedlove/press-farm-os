-- Migration 011: Plantings — Tend-style crop plan
-- Replaces simple crop_plan_entries with detailed planting records

CREATE TABLE IF NOT EXISTS plantings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,

  -- Crop identification (links to items table or freeform)
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  crop_name text NOT NULL,
  variety text,

  -- Growing info
  category text CHECK (category IN (
    'micro', 'flowers', 'leaf', 'brassicas', 'roots', 'fruit', 'wilds', 'herbs', 'other'
  )),
  growing_location text CHECK (growing_location IN ('in_ground', 'in_containers')) DEFAULT 'in_ground',
  planting_stock text CHECK (planting_stock IN ('seeds', 'plugs', 'transplants', 'cuttings', 'bulbs', 'other')) DEFAULT 'seeds',
  sowing_method text,
  container_type text,

  -- Dates (the core of the Gantt timeline)
  sow_date date,
  transplant_date date,
  harvest_start date,
  harvest_end date,
  termination_date date,
  days_to_maturity integer,

  -- Amounts
  quantity integer,
  quantity_unit text DEFAULT 'plants', -- plants, containers, beds, sq_ft
  beds integer,
  bed_feet decimal(8,1),

  -- Location on farm
  location text, -- e.g. "Field (Orchard)", "Back Wall", "Planter Bed"

  -- Harvest & revenue
  harvest_unit text, -- sm, lg, lbs, ea, etc
  avg_yield decimal(8,2),
  avg_price decimal(8,2),
  projected_revenue decimal(10,2),

  -- Status tracking
  status text CHECK (status IN ('planned', 'planted', 'growing', 'harvesting', 'terminated', 'cancelled')) DEFAULT 'planned',

  -- Notes
  notes text,

  -- Season (derived from sow_date, but useful for filtering)
  season integer DEFAULT 2026,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE plantings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to plantings"
  ON plantings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER update_plantings_updated_at
  BEFORE UPDATE ON plantings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for timeline queries
CREATE INDEX idx_plantings_dates ON plantings (sow_date, harvest_start, harvest_end);
CREATE INDEX idx_plantings_season ON plantings (season);
