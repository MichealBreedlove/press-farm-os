-- Migration 009: Phase 2 features
-- Container calculator (no schema change), product photos, family meal,
-- seasonal alerts, bonus delivery items, labor tracking

-- 1. Product photos on items
ALTER TABLE items ADD COLUMN IF NOT EXISTS image_url text;

-- 2. Seasonal availability status on items
ALTER TABLE items ADD COLUMN IF NOT EXISTS season_status text DEFAULT 'available';
ALTER TABLE items ADD COLUMN IF NOT EXISTS season_note text;
ALTER TABLE items ADD CONSTRAINT items_season_status_check
  CHECK (season_status IN ('available', 'ending_soon', 'coming_soon', 'out_of_season'));

-- 3. Family meal category — drop and recreate the check constraint
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_category_check;
ALTER TABLE items ADD CONSTRAINT items_category_check
  CHECK (category IN ('flowers', 'micros_leaves', 'herbs_leaves', 'fruit_veg', 'kits', 'family_meal'));

-- 4. Bonus items on deliveries (samples, family meal extras not from orders)
ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS is_bonus boolean DEFAULT false;
ALTER TABLE delivery_items ADD COLUMN IF NOT EXISTS bonus_note text;

-- 5. Labor tracking
CREATE TABLE IF NOT EXISTS labor_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  worker_name text NOT NULL,
  date date NOT NULL,
  hours decimal(4,1) NOT NULL CHECK (hours > 0 AND hours <= 24),
  hourly_rate decimal(6,2),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for labor_entries (admin only via is_admin())
ALTER TABLE labor_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to labor_entries"
  ON labor_entries FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Trigger for updated_at on labor_entries
CREATE TRIGGER update_labor_entries_updated_at
  BEFORE UPDATE ON labor_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
