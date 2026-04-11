-- Migration 014: Growing conditions data, auto-tasks, photo uploads

-- Growing conditions on items
ALTER TABLE items ADD COLUMN IF NOT EXISTS days_to_maturity integer;
ALTER TABLE items ADD COLUMN IF NOT EXISTS sow_depth text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS plant_spacing text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS row_spacing text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS sun_requirement text CHECK (sun_requirement IN ('full_sun', 'part_shade', 'shade', 'sun_part_shade'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS soil_temp_min integer; -- degrees F for germination
ALTER TABLE items ADD COLUMN IF NOT EXISTS growing_zone text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS sow_method text CHECK (sow_method IN ('direct_seed', 'transplant', 'both'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS indoor_start_weeks integer; -- weeks before last frost
ALTER TABLE items ADD COLUMN IF NOT EXISTS growing_notes text;

-- Auto-generated tasks from plantings
CREATE TABLE IF NOT EXISTS planting_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planting_id uuid NOT NULL REFERENCES plantings(id) ON DELETE CASCADE,
  task_type text NOT NULL CHECK (task_type IN (
    'bed_prep', 'sow', 'transplant', 'cultivate', 'harvest', 'terminate', 'other'
  )),
  title text NOT NULL,
  due_date date,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE planting_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to planting_tasks"
  ON planting_tasks FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER update_planting_tasks_updated_at
  BEFORE UPDATE ON planting_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_planting_tasks_due ON planting_tasks (due_date, completed);
CREATE INDEX idx_planting_tasks_planting ON planting_tasks (planting_id);
