-- Migration 069: per-size pricing (items.size_prices)
--
-- Pricing has been per-UNIT only (items.unit_prices keyed by unit code, with
-- items.default_price as fallback). Sizes (items."size", a comma-separated
-- label list; order_items.size_label per line) carried no price of their own,
-- so e.g. Nasturtium "Palm" leaves billed the same $0.40/ea as every other
-- size even though a Palm leaf is worth more.
--
-- size_prices is a JSONB map keyed by the size label, e.g. {"Palm": 1}. It is
-- the MOST specific tier and wins over unit_prices/default_price when a line's
-- size_label matches. Empty {} (the default) means "no size pricing" — every
-- existing item is unaffected, so this is purely additive.
--
-- Scoped use today: only Nasturtium leaves get a size price (Palm = $1/ea).
-- The other sizes (Dime - Nickel, Quarter, Dollar) fall through to the $0.40
-- per-unit price exactly as before.

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS size_prices jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE items
  SET size_prices = '{"Palm": 1}'::jsonb,
      updated_at = now()
  WHERE name = 'Nasturtium';
