-- 022: Per-unit pricing
--
-- Items can now be sold in multiple containers (Small To Go, Large To Go, Green Bin, …)
-- and each container has its own price. We store a JSON map of unit code → price.
--
--   unit_prices: { "sm": 15.00, "lg": 30.00, "ea": 1.00 }
--
-- The existing items.default_price column is preserved as a fallback when an item is
-- offered in a unit that isn't keyed in unit_prices (e.g. legacy single-unit items).

ALTER TABLE items ADD COLUMN IF NOT EXISTS unit_prices jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Index on the JSONB column so any future "items containing this unit" filters are cheap.
CREATE INDEX IF NOT EXISTS idx_items_unit_prices ON items USING gin (unit_prices);
