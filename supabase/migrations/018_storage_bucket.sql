-- 018: Supabase Storage bucket for item photos
-- Run this in Supabase SQL editor. The bucket must also be created
-- via the Supabase dashboard or CLI: Storage → New Bucket → "item-photos" (public)

-- Allow public read access to item-photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-photos', 'item-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload (admin check done in API)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'item-photos');

-- Allow authenticated users to update/delete their uploads
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'item-photos');

CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'item-photos');

-- Allow public read access
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'item-photos');
