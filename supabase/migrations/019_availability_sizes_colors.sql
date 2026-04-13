-- 019: Add available_sizes and available_colors to availability_items
-- These are comma-separated strings of which sizes/colors are available for this date
-- NULL means "all sizes/colors from the item are available"
ALTER TABLE availability_items ADD COLUMN IF NOT EXISTS available_sizes text;
ALTER TABLE availability_items ADD COLUMN IF NOT EXISTS available_colors text;
