-- Migration 016: Add size and variety fields to items
-- Size is free text (comma-separated for multiple) — no check constraint
ALTER TABLE items ADD COLUMN IF NOT EXISTS size text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS variety text;
-- Drop old check constraint if it exists
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_size_check;
ALTER TABLE items ADD COLUMN IF NOT EXISTS color text;
