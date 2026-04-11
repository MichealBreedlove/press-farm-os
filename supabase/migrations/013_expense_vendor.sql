-- Migration 013: Add vendor field to expenses
ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS vendor text;
