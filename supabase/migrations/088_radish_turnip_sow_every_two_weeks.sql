-- Migration 088: Radish + Turnip sowing → every two weeks, direct seeded
--
-- DATA FIX (Micheal 2026-10-11): "Change the task sow radishes and sow
-- turnips to every two weeks. Instead of broadcasting we will direct seed
-- every half inch."
--
-- 1. Radish + Turnip recurring sow schedules go 25d → 14d, with the how-to in
--    recurring_sow_notes (which becomes the task description). Both had a
--    NULL anchor, which made the generator re-date the task to "today" every
--    night (see the trail of superseded rec:* rows). Anchors are set so the
--    cadence lines up with the job list's next dates:
--      Radish  anchor 09/28 → 10/12, 10/26, 11/09 …
--      Turnip  anchor 10/05 → 10/19, 11/02, 11/16 …
-- 2. The recurring tasks are now the single source for these sows, so the
--    still-open "Sow the radishes" / "Sow the turnips" job-list tasks (Jang
--    seeder method) are superseded — reversible by setting status back to
--    'open'.
-- 3. Open rec:* tasks for both items are superseded and the in-horizon dates
--    on the new cadence inserted (the nightly tasks cron would do the same;
--    this just makes /admin/tasks correct immediately). Safe to re-run.

UPDATE items SET
  recurring_sow_interval_days = 14,
  recurring_sow_anchor_date = '2026-09-28',
  recurring_sow_notes = 'Where: Quadrant 2, rows 2-3. How: Direct seed one seed every 1/2 inch (no broadcasting). How much: 5 feet of row. ES: Sembrar los rabanos directo, una semilla cada media pulgada (no al voleo).',
  updated_at = now()
WHERE id = 'eedb9e62-5ad6-4044-88cf-1e11b3f6bdca';  -- Radish

UPDATE items SET
  recurring_sow_interval_days = 14,
  recurring_sow_anchor_date = '2026-10-05',
  recurring_sow_notes = 'Where: Quadrant 2, row 4. How: Direct seed one seed every 1/2 inch (no broadcasting). How much: 5 feet of row. ES: Sembrar los nabos directo, una semilla cada media pulgada (no al voleo).',
  updated_at = now()
WHERE id = 'b9e401a4-b7c7-4dc6-886c-d4eb483fb90f';  -- Turnip

UPDATE farm_tasks SET
  status = 'superseded',
  superseded_at = now(),
  superseded_reason = 'replaced by 14-day direct-seed recurring schedule (migration 088)'
WHERE status = 'open'
  AND source = 'manual'
  AND generator_key ~ '^joblist2026-\d{4}-sow-the-(radishes|turnips)$';

UPDATE farm_tasks SET
  status = 'superseded',
  superseded_at = now(),
  superseded_reason = 'recurring schedule changed to every 14d (migration 088)'
WHERE status = 'open'
  AND source = 'recurring-item'
  AND item_id IN ('eedb9e62-5ad6-4044-88cf-1e11b3f6bdca', 'b9e401a4-b7c7-4dc6-886c-d4eb483fb90f')
  AND generator_key NOT IN (
    'rec:eedb9e62-5ad6-4044-88cf-1e11b3f6bdca:2026-10-12',
    'rec:eedb9e62-5ad6-4044-88cf-1e11b3f6bdca:2026-10-26',
    'rec:eedb9e62-5ad6-4044-88cf-1e11b3f6bdca:2026-11-09',
    'rec:b9e401a4-b7c7-4dc6-886c-d4eb483fb90f:2026-10-19',
    'rec:b9e401a4-b7c7-4dc6-886c-d4eb483fb90f:2026-11-02'
  );

INSERT INTO farm_tasks (farm_id, title, description, type, source, source_ref, generator_key, due_date, priority, status, item_id)
SELECT i.farm_id,
       'Sow ' || i.name || ' (recurring every 14d)',
       i.recurring_sow_notes,
       'sow', 'recurring-item',
       jsonb_build_object('item_id', i.id, 'interval_days', 14, 'recurrence_anchor_date', i.recurring_sow_anchor_date),
       'rec:' || i.id || ':' || d.due,
       d.due::date, 2, 'open', i.id
FROM items i
JOIN (VALUES
  ('eedb9e62-5ad6-4044-88cf-1e11b3f6bdca'::uuid, '2026-10-12'),
  ('eedb9e62-5ad6-4044-88cf-1e11b3f6bdca'::uuid, '2026-10-26'),
  ('eedb9e62-5ad6-4044-88cf-1e11b3f6bdca'::uuid, '2026-11-09'),
  ('b9e401a4-b7c7-4dc6-886c-d4eb483fb90f'::uuid, '2026-10-19'),
  ('b9e401a4-b7c7-4dc6-886c-d4eb483fb90f'::uuid, '2026-11-02')
) AS d(item_id, due) ON d.item_id = i.id
-- An old superseded row can already hold the key (the NULL-anchor slide
-- generated one per day), so reopen it rather than skip it.
ON CONFLICT (generator_key) DO UPDATE SET
  status = 'open',
  superseded_at = NULL,
  superseded_reason = NULL,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  source_ref = EXCLUDED.source_ref;
