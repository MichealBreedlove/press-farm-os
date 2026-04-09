-- Migration 012: Farm settings key-value store
-- For email addresses and other configurable settings

CREATE TABLE IF NOT EXISTS farm_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(farm_id, key)
);

ALTER TABLE farm_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to farm_settings"
  ON farm_settings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE TRIGGER update_farm_settings_updated_at
  BEFORE UPDATE ON farm_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
