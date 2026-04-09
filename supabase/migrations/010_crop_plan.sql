-- Migration 010: Crop Plan
-- Seasonal crop planning with Gantt-style timeline

CREATE TABLE IF NOT EXISTS crop_plan_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  category text NOT NULL CHECK (category IN (
    'micro', 'flowers', 'leaf', 'brassicas', 'roots', 'fruit', 'wilds', 'oils'
  )),
  season text NOT NULL CHECK (season IN (
    'early_winter', 'late_winter', 'early_spring', 'late_spring',
    'early_summer', 'summer', 'late_summer', 'early_fall', 'late_fall'
  )),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE crop_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to crop_plan_entries"
  ON crop_plan_entries FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER update_crop_plan_entries_updated_at
  BEFORE UPDATE ON crop_plan_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
