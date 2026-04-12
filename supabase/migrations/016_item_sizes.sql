-- Migration 016: Add size and variety fields to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS size text CHECK (size IN ('tiny', 'small', 'medium', 'large'));
ALTER TABLE items ADD COLUMN IF NOT EXISTS variety text;
