-- Migration 015: Suggestions table (replaces localStorage)

CREATE TABLE IF NOT EXISTS suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  text text NOT NULL,
  author text DEFAULT 'Anonymous',
  status text CHECK (status IN ('new', 'reviewed', 'implemented', 'declined')) DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to suggestions"
  ON suggestions FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER update_suggestions_updated_at
  BEFORE UPDATE ON suggestions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
