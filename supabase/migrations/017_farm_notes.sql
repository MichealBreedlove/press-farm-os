-- 017: Farm notes — field observations persisted to DB
CREATE TABLE IF NOT EXISTS farm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id),
  date date NOT NULL DEFAULT CURRENT_DATE,
  text text NOT NULL,
  category text NOT NULL DEFAULT 'observation'
    CHECK (category IN ('observation', 'season_update', 'task', 'harvest_note', 'general')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_farm_notes_date ON farm_notes(date DESC);
ALTER TABLE farm_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY farm_notes_admin_all ON farm_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE TRIGGER set_farm_notes_updated_at
  BEFORE UPDATE ON farm_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
