-- 030: Independent menu placement — items can appear in any combination
-- of Regular / Events / Press Bar instead of being locked to exactly one.
--
-- Migration 023 introduced is_event_item, migration 028 added
-- is_press_bar_item, and the UI used a 3-way mutually-exclusive radio
-- picker so each item lived in exactly one menu. User wants flexibility:
-- a Marigold can be on the Regular kitchen list AND the cocktail bar's
-- garnish list — no need to duplicate the item record.
--
-- Adds the third independent flag for Regular Menu visibility (default
-- true so every existing row continues to appear there). With this in
-- place the chef order form filter can OR-include each section
-- independently and the item edit page swaps the radio for three
-- checkboxes.
--
-- Indexed because the chef /order page filters by this on every load,
-- mirroring the indexes added in 023 + 028.

ALTER TABLE items ADD COLUMN IF NOT EXISTS show_in_regular_menu boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_items_regular_menu ON items(show_in_regular_menu);
