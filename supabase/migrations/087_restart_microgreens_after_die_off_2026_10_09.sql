-- 087 — DATA FIX: restart microgreens production after the 2026-10-05 heat
-- die-off (all 44 in-flight trays marked lost).
--
-- The fall 2026 demand schedule (set 09-19 / 09-26) still started at 10/05–
-- 10/12, so the sow plan kept 17 open "overdue" sow tasks for deliveries a
-- tray sown now can't reach (e.g. Mustard for 10/12 needed sowing 9/27).
--
-- 1. Each demand row's effective_from moves to the FIRST delivery date on its
--    weekday whose sow date (delivery − crop.ideal_harvest_day) is on or after
--    2026-10-10 — i.e. the first delivery a fresh sow can actually make.
--    Quantities, weekdays and intervals are unchanged. For the biweekly
--    Nasturtium row this also re-anchors its every-2-weeks cadence there.
--    Resulting first deliveries (sow date): Mustard, Pea ×2 10/26 (10/11),
--    Kale 10/26 (10/13), Marigold 10/29 (10/11), Chervil 11/02 (10/11),
--    Borage, Fava 10/31 (10/12), Nasturtium 10/22 (10/12).
-- 2. The open microgreens-auto sow tasks for unreachable deliveries are
--    superseded now (the nightly tasks-regenerate cron would do the same on
--    its next run; this just clears /admin/tasks immediately). The cron
--    (09:00 UTC) creates the new sow tasks on their sow dates.
--
-- Old effective_from kept in each demand row's notes. Re-running is a no-op
-- (the marker in notes guards step 1; step 2 only touches open tasks whose
-- delivery precedes the new start).

UPDATE microgreen_demand d
SET effective_from = nf.first_delivery,
    notes = concat_ws(' ', d.notes,
              '[Restarted 2026-10-09 after heat die-off (migration 087); was effective_from '
              || coalesce(d.effective_from::text, 'none') || ']')
FROM (
  SELECT d2.id,
         (SELECT min(dd.date)
            FROM delivery_dates dd
           WHERE extract(dow FROM dd.date) = d2.day_of_week
             AND dd.date - c.ideal_harvest_day >= DATE '2026-10-10') AS first_delivery
    FROM microgreen_demand d2
    JOIN microgreen_crops c ON c.id = d2.crop_id
   WHERE d2.effective_to IS NULL
) nf
WHERE d.id = nf.id
  AND nf.first_delivery IS NOT NULL
  AND coalesce(d.notes, '') NOT LIKE '%(migration 087)%';

UPDATE farm_tasks t
SET status = 'superseded',
    superseded_at = now(),
    superseded_reason = 'restart after 2026-10-05 heat die-off (migration 087) — delivery no longer reachable'
WHERE t.source = 'microgreens-auto'
  AND t.type = 'sow'
  AND t.status = 'open'
  AND (t.source_ref->>'delivery_date')::date < (
        SELECT min(d.effective_from)
          FROM microgreen_demand d
         WHERE d.crop_id = t.microgreen_crop_id
      );

-- Rollback: set each demand row's effective_from back to the date in its
-- "[Restarted … was effective_from X]" note.
