-- Migration 083: Microgreens restart after heat loss (DATA-ONLY)
--
-- Every live tray was lost to heat (early Oct 2026). Micheal is starting the
-- microgreens program over from 2026-10-03. Three steps:
--
--   1. All 44 live trays (blackout / light / harvesting) → status 'lost',
--      lost_reason 'Heat loss', terminated_at = now(). Rows are kept so batch and
--      tray history stays intact for reporting.
--   2. Each open-ended demand row's effective_from moves to the first delivery
--      day of its weekday that a tray sown on 2026-10-03 can reach
--      (restart + ideal_harvest_day). The old starts (Oct 5–12) can't be met from
--      empty trays and would only have shown up as overdue sows. The anchor also
--      resets Nasturtium's every-2-weeks cadence.
--   3. Every open 'microgreens-auto' farm task (sow tasks for the old
--      dates and harvest tasks for the dead trays) → superseded. The nightly
--      tasks-regenerate cron writes the new sow plan.
--
-- Resulting first harvests (sow date = delivery − ideal_harvest_day):
--   Nasturtium   Thu 10/15 (sow 10/05)   Kale / Mustard / Pea ×2  Mon 10/19
--   Marigold     Thu 10/22 (sow 10/04)   Borage / Fava            Sat 10/24
--   Chervil      Mon 10/26 (sow 10/04)
--
-- Rollback (prior status is recoverable from the stage timestamps — verified
-- 3 blackout / 30 light / 11 harvesting before applying):
--   UPDATE microgreen_trays SET status = (CASE WHEN harvesting_start IS NOT NULL THEN 'harvesting'
--            WHEN light_start IS NOT NULL THEN 'light' ELSE 'blackout' END)::microgreen_tray_status,
--          lost_reason = NULL, terminated_at = NULL
--   WHERE status = 'lost' AND notes LIKE '%(migration 083)%';
--   Demand starts before this change: Borage 10-10, Chervil 10-12, Fava Bean 10-10,
--   Kale 10-12, Marigold 10-08, Mustard 10-12, Nasturtium 10-01, Pea Calvin 10-05,
--   Pea Frilly 10-05 (also recorded in each row's notes).
-- STATUS: NOT YET APPLIED — the MCP apply on 2026-10-03 was cancelled pending Micheal's go-ahead.

BEGIN;

UPDATE microgreen_trays
SET status = 'lost',
    lost_reason = 'Heat loss',
    terminated_at = now(),
    notes = concat_ws(E'\n', nullif(notes, ''), 'Lost to heat; restarted microgreens 2026-10-03 (migration 083)')
WHERE status IN ('soaking', 'blackout', 'light', 'harvesting');

-- First date on/after (restart + ideal_harvest_day) whose weekday matches the row.
UPDATE microgreen_demand d
SET effective_from = (DATE '2026-10-03' + c.ideal_harvest_day)
                     + ((d.day_of_week - extract(dow FROM DATE '2026-10-03' + c.ideal_harvest_day)::int + 7) % 7),
    notes = concat_ws(E'\n', nullif(d.notes, ''), 'Start moved from ' || d.effective_from || ' after heat-loss restart (migration 083)')
FROM microgreen_crops c
WHERE c.id = d.crop_id
  AND d.effective_to IS NULL;

UPDATE farm_tasks
SET status = 'superseded',
    superseded_at = now(),
    superseded_reason = 'heat loss — microgreens restarted 2026-10-03'
WHERE source = 'microgreens-auto'
  AND status = 'open';

COMMIT;
