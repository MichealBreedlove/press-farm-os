-- Migration 047: Farmer pay rates (effective-dated)
-- Replaces the hardcoded $12K/quarter constant in the executive + income reports
-- with a date-effective rate table so future pay changes are data, not code.
--
-- Two pay models are supported per row (CHECK enforces exactly one):
--   * hourly  : hourly_rate * hours_per_week  -> a weekly amount, prorated by day
--   * flat    : flat_quarterly                -> a per-quarter amount, prorated by day
--
-- Farmer pay for a quarter is summed day-by-day using whichever rate is in
-- effect on each day (latest effective_date <= that day). This keeps full
-- legacy quarters at exactly $12,000 while prorating the partial quarter
-- (Q2 2026) across the rate change on 2026-05-24.

CREATE TABLE IF NOT EXISTS farmer_pay_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  effective_date date NOT NULL,
  hourly_rate decimal(8,2),
  hours_per_week decimal(5,1),
  flat_quarterly decimal(10,2),
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT farmer_pay_rate_model CHECK (
    (hourly_rate IS NOT NULL AND hours_per_week IS NOT NULL AND flat_quarterly IS NULL)
    OR
    (flat_quarterly IS NOT NULL AND hourly_rate IS NULL AND hours_per_week IS NULL)
  ),
  UNIQUE (farm_id, effective_date)
);

ALTER TABLE farmer_pay_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to farmer_pay_rates"
  ON farmer_pay_rates FOR ALL USING (private.is_admin()) WITH CHECK (private.is_admin());

CREATE TRIGGER update_farmer_pay_rates_updated_at
  BEFORE UPDATE ON farmer_pay_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Seed: legacy flat rate (all history up to the change) + new hourly rate.
-- effective_date 2020-01-01 guarantees the legacy rate covers every quarter
-- that has delivery data prior to the 2026-05-24 change.
INSERT INTO farmer_pay_rates (farm_id, effective_date, flat_quarterly, hourly_rate, hours_per_week, note)
VALUES
  ((SELECT id FROM farms WHERE name = 'Press Farm'), '2020-01-01', 12000, NULL, NULL,
    'Legacy flat farmer pay: $12,000 / quarter'),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), '2026-05-24', NULL, 30, 40,
    '$30/hr @ 40 hrs/week')
ON CONFLICT (farm_id, effective_date) DO NOTHING;
