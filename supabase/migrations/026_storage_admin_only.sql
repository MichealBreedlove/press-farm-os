-- 026: Lock down item-photos storage to admin-only writes.
--
-- Migration 018 created broad "Allow authenticated uploads/updates/deletes"
-- policies so any signed-in user (chef, receiver) could write to the bucket.
-- The /api/upload route checks admin role before forwarding the upload, but
-- the policies were bypassable: anyone with a valid Supabase session could
-- POST directly to the storage REST API and upload/replace/delete photos.
--
-- This migration replaces those policies with admin-only equivalents using
-- the existing is_admin() helper. Public reads stay; the public read policy
-- is unchanged.

-- Drop the over-permissive policies from migration 018
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Re-add admin-only INSERT / UPDATE / DELETE
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin item-photos insert' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Admin item-photos insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'item-photos' AND is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin item-photos update' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Admin item-photos update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'item-photos' AND is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin item-photos delete' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Admin item-photos delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'item-photos' AND is_admin());
  END IF;
END $$;

-- Public read policy unchanged from migration 018; storage bucket itself
-- is still public so chef/receiver UIs can <img src="..."> the photos.
