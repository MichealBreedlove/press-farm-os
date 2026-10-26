-- 095 — DATA: add Shiso to the weekly microgreens sow list (per Micheal
-- 2026-10-26).
--
-- Shiso (the generic, no-variety library row) was in the variety library but
-- inactive with no demand, so the sow plan never scheduled it.
--
-- 1. Activate it and move ideal_harvest_day 26 → 27 (still inside its 21–31
--    day harvest window). The sow plan sows on delivery − ideal_harvest_day,
--    and no Thu/Sat/Mon delivery is 26 days after a Friday — 27 days puts the
--    sow on Friday, the farm's single sow day, like every other crop.
-- 2. Weekly demand: 1 LG (1 tray) every Thursday, farm-wide — same size as
--    the current Borage / Chervil / Marigold rows. First sow Fri 2026-10-30 →
--    first delivery Thu 2026-11-26.
--
-- Re-running is a no-op (step 2 skips when an open Shiso demand row exists).

UPDATE microgreen_crops
SET is_active = true,
    ideal_harvest_day = 27,
    notes = concat_ws(' ', notes,
              '[2026-10-26: activated for the weekly sow list, ideal_harvest_day 26 → 27 so the sow lands on Friday (migration 095)]')
WHERE name = 'Shiso' AND variety IS NULL
  AND coalesce(notes, '') NOT LIKE '%(migration 095)%';

INSERT INTO microgreen_demand
  (crop_id, restaurant_id, day_of_week, target_quantity, target_unit, interval_weeks, effective_from, notes)
SELECT c.id, NULL, 4, 1, 'lg', 1, DATE '2026-11-26',
       'Shiso — 1 tray weekly, farm-wide (added 2026-10-26, per Micheal; sow Friday, deliver Thursday) (migration 095)'
FROM microgreen_crops c
WHERE c.name = 'Shiso' AND c.variety IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM microgreen_demand d
     WHERE d.crop_id = c.id AND d.effective_to IS NULL
  );

-- Rollback:
--   DELETE FROM microgreen_demand WHERE notes LIKE '%(migration 095)%';
--   UPDATE microgreen_crops SET is_active = false, ideal_harvest_day = 26
--    WHERE name = 'Shiso' AND variety IS NULL;
