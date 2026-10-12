-- 093 — DATA FIX: square photos for Wasabinia + Moonshadow (Micheal, 2026-10-12).
--
-- Both items carried tall phone-shaped uploads (about 1:2). The order form
-- fills a square thumbnail with `object-cover`, so only the middle of each
-- leaf showed and it read as zoomed in. The same two photos, padded to a
-- white square (768px), now ship as repo assets and the items point at them.
--
-- Previous image_url values (still in the item-photos bucket; rollback = set
-- them back):
--   Wasabinia  → …/item-photos/items/1000011215-1791789089115-0.jpg
--   Moonshadow → …/item-photos/items/1000011216-1791789273227-0.jpg
--
-- Data-only; re-running is a no-op. Run AFTER the deploy that carries the
-- assets, or the images 404.

UPDATE items SET image_url = '/assets/pressfarm/items/wasabina.jpg', updated_at = now()
WHERE name = 'Wasabinia' AND category = 'herbs_leaves' AND is_archived = false;

UPDATE items SET image_url = '/assets/pressfarm/items/moonshadow.jpg', updated_at = now()
WHERE name = 'Moonshadow' AND category = 'herbs_leaves' AND is_archived = false;
