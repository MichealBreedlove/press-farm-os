-- 032_items_unique_per_category.sql
-- Replaces the old UNIQUE(farm_id, name) constraint on items with
-- UNIQUE(farm_id, name, category) so the same name can exist across
-- categories (e.g. "Basil" as a herb_leaves item AND "Basil" as a
-- flowers item for basil blossoms). True duplicates within a single
-- category remain blocked.
--
-- The old constraint was added via the Supabase dashboard (no migration
-- file references it), so the auto-generated constraint name is unknown.
-- The DO block locates and drops any UNIQUE constraint on items whose
-- columns are exactly (farm_id, name). This also drops the unique-index
-- twin if the constraint was created via CREATE UNIQUE INDEX.
--
-- The CSV importer (src/app/api/import/items-csv/route.ts) ships in
-- the same change set, with onConflict updated to the new (farm_id,
-- name, category) tuple so its upsert logic keeps working.

DO $$
DECLARE
  conname_to_drop text;
BEGIN
  SELECT c.conname INTO conname_to_drop
  FROM pg_constraint c
  WHERE c.conrelid = 'items'::regclass
    AND c.contype = 'u'
    AND (
      SELECT array_agg(a.attname ORDER BY a.attnum)
      FROM pg_attribute a
      WHERE a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    ) = ARRAY['farm_id'::name, 'name'::name]
  LIMIT 1;

  IF conname_to_drop IS NOT NULL THEN
    EXECUTE format('ALTER TABLE items DROP CONSTRAINT %I', conname_to_drop);
  END IF;
END $$;

-- Drop any leftover unique index on (farm_id, name) — same pattern, in
-- case the original was created as a unique index without a constraint
-- attached. Safe to no-op if it doesn't exist.
DO $$
DECLARE
  idxname_to_drop text;
BEGIN
  SELECT i.indexname INTO idxname_to_drop
  FROM pg_indexes i
  JOIN pg_class c ON c.relname = i.indexname
  JOIN pg_index pi ON pi.indexrelid = c.oid
  WHERE i.tablename = 'items'
    AND pi.indisunique = true
    AND (
      SELECT array_agg(a.attname ORDER BY a.attnum)
      FROM pg_attribute a
      WHERE a.attrelid = pi.indrelid AND a.attnum = ANY(pi.indkey)
    ) = ARRAY['farm_id'::name, 'name'::name]
  LIMIT 1;

  IF idxname_to_drop IS NOT NULL THEN
    EXECUTE format('DROP INDEX IF EXISTS %I', idxname_to_drop);
  END IF;
END $$;

-- Add the new constraint. Idempotent — safe to re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'items'::regclass
      AND contype = 'u'
      AND conname = 'items_farm_id_name_category_key'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_farm_id_name_category_key
      UNIQUE (farm_id, name, category);
  END IF;
END $$;

COMMENT ON CONSTRAINT items_farm_id_name_category_key ON items IS
  'Ensures items are unique per (farm, name, category). Same name is allowed across categories — e.g. "Basil" as a herb AND "Basil" as a flower.';
