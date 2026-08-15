-- 074_microgreens_reset_2026_08_14.sql
--
-- Data-only migration. Resets the microgreens board and records what Micheal
-- actually sowed on 2026-08-14, transcribed from his field list.
--
-- Why: microgreen_batches / _trays / _harvests were empty while farm_tasks still
-- carried 24 open `microgreens-auto` rows generated against demand with nothing
-- in the ground. The task board was fiction. This clears it and re-anchors the
-- module to real trays so computeSowPlan() + regenerateMicrogreensTasks()
-- produce a truthful advance/harvest list.
--
-- Field list (10 lines, 31 trays, all sown 2026-08-14):
--   1 Shiso (Purple) | 2 Mustard | 2 Kale | 1 Salad Burnet | 4 Mustard
--   2 Borage         | 3 Kale    | 5 Pea (Calvin) | 5 Nasturtium | 6 Kale
--
-- "Salad brunette" -> Salad Burnet, "Borg" -> Borage. Shiso variety (Purple) and
-- Pea variety (Calvin) confirmed by Micheal 2026-08-15.
--
-- Manual farm_tasks (crop plan, transplants, delivery-prep) are deliberately
-- left untouched — only the auto-generated microgreens board is cleared.

-- ---------------------------------------------------------------------------
-- 1. Clear the stale auto-generated microgreens task board.
--    Step 4 then reopens whatever the recomputed plan still calls for, so the
--    net effect is "rebuild", not "delete".
-- ---------------------------------------------------------------------------
update farm_tasks
   set status            = 'superseded',
       superseded_at     = now(),
       superseded_reason = 'microgreens board reset 2026-08-14'
 where source = 'microgreens-auto'
   and status = 'open';

-- ---------------------------------------------------------------------------
-- 2. Clear any pre-existing batches (cascades to trays + harvests).
--    Bounded to sow_date < 2026-08-14 so a re-run can never wipe this seeding
--    or anything sown after it.
-- ---------------------------------------------------------------------------
delete from microgreen_batches
 where sow_date < date '2026-08-14';

-- ---------------------------------------------------------------------------
-- 3. Seed the 2026-08-14 sowing. One batch per line so the board mirrors the
--    field list rather than collapsing repeats (Kale appears 3x, Mustard 2x).
-- ---------------------------------------------------------------------------
create temp table _mg_seed_lines (
  seq         int  not null,
  batch_id    uuid not null default gen_random_uuid(),
  crop_id     uuid not null,
  tray_count  int  not null
) on commit drop;

insert into _mg_seed_lines (seq, crop_id, tray_count) values
  ( 1, '91ead4a4-2a7b-49c3-8797-1d248be6534d', 1),  -- Shiso (Purple)
  ( 2, '3f408b8c-8b80-4ee8-8067-0b89fc56e519', 2),  -- Mustard
  ( 3, 'e53f2a0c-bb4e-4ee7-87ff-ed20a2f99217', 2),  -- Kale
  ( 4, 'f4d795f3-db26-4a74-a696-c53cfa6a2c00', 1),  -- Salad Burnet
  ( 5, '3f408b8c-8b80-4ee8-8067-0b89fc56e519', 4),  -- Mustard
  ( 6, 'eb1cddf5-3bb2-4bfb-90c7-444e7a395027', 2),  -- Borage
  ( 7, 'e53f2a0c-bb4e-4ee7-87ff-ed20a2f99217', 3),  -- Kale
  ( 8, 'f26833aa-09bd-4ceb-95fb-0b95e52b282c', 5),  -- Pea (Calvin)
  ( 9, '13c332cb-9cb5-4b95-8fe0-225cb8564f5d', 5),  -- Nasturtium
  (10, 'e53f2a0c-bb4e-4ee7-87ff-ed20a2f99217', 6);  -- Kale

-- Batches. Dates derive from each crop's own blackout_days / ideal_harvest_day
-- so they stay consistent with the app's date math in /api/microgreens/batches.
-- soak_started_at is back-dated to end at sow time for crops that need a soak
-- (the soak precedes sowing, so it was already complete on 2026-08-14).
insert into microgreen_batches
  (id, crop_id, sow_date, soak_started_at, planned_blackout_end, planned_harvest_date, tray_count, notes)
select l.batch_id,
       l.crop_id,
       date '2026-08-14',
       case when c.presoak_hours + c.presprout_hours > 0
            then timestamptz '2026-08-14 07:00:00+00'
                 - make_interval(hours => c.presoak_hours + c.presprout_hours)
            else null
       end,
       date '2026-08-14' + c.blackout_days,
       date '2026-08-14' + c.ideal_harvest_day,
       l.tray_count,
       'Sown 2026-08-14 — field list line ' || l.seq
  from _mg_seed_lines l
  join microgreen_crops c on c.id = l.crop_id;

-- Trays. Sown yesterday, so any soak is finished: everything is in blackout,
-- except zero-blackout crops (Nasturtium) which go straight to light.
-- Labels match buildTrayLabel(): crop initials + MMDD + sequence, numbered
-- continuously per crop across lines so repeats don't collide.
insert into microgreen_trays
  (batch_id, tray_label, status, sow_date, blackout_start, light_start)
select l.batch_id,
       case when position(' ' in btrim(c.name)) = 0
            then upper(left(btrim(c.name), 2))
            else upper(left(split_part(btrim(c.name), ' ', 1), 1)
                    || left(split_part(btrim(c.name), ' ', 2), 1))
       end
       || '-0814-'
       || lpad((row_number() over (partition by c.name order by l.seq, g.n))::text, 2, '0'),
       (case when c.blackout_days = 0 then 'light' else 'blackout' end)::microgreen_tray_status,
       date '2026-08-14',
       date '2026-08-14',
       case when c.blackout_days = 0 then date '2026-08-14' else null end
  from _mg_seed_lines l
  join microgreen_crops c on c.id = l.crop_id
  cross join lateral generate_series(1, l.tray_count) as g(n);

-- ---------------------------------------------------------------------------
-- 4. Rebuild the board: reopen every task the recomputed sow plan still calls
--    for. Step 1 superseded them all; this is the recomputed output of
--    computeSowPlan() as of 2026-08-15, with the 31 new trays counted as
--    in-flight. The one key deliberately left superseded is
--    mg:sow:<mustard>:2026-08-29 — the 6 mustard trays now cover it.
--
--    An UPDATE rather than an INSERT because generator_key is UNIQUE: the
--    superseded rows still hold these keys, so ON CONFLICT DO NOTHING would
--    silently skip them. (That same hole in the nightly cron is fixed in code
--    by src/lib/tasks/reopen.ts, shipped alongside this migration.)
-- ---------------------------------------------------------------------------
with plan(crop_id, delivery_date, sow_date, trays) as (values
  ('eb1cddf5-3bb2-4bfb-90c7-444e7a395027'::uuid,'2026-09-03'::date,'2026-08-15'::date,1), -- Borage
  ('d713a28e-1c48-439a-93a2-3925db5f1da6','2026-08-17','2026-07-31',1),  -- Amaranth
  ('d713a28e-1c48-439a-93a2-3925db5f1da6','2026-08-24','2026-08-07',1),
  ('d713a28e-1c48-439a-93a2-3925db5f1da6','2026-08-31','2026-08-14',1),
  ('afcf9241-7310-4fac-ae5c-f5196796c5c1','2026-08-20','2026-08-10',1),  -- Sunflower
  ('eb1cddf5-3bb2-4bfb-90c7-444e7a395027','2026-08-20','2026-08-01',1),  -- Borage
  ('eb1cddf5-3bb2-4bfb-90c7-444e7a395027','2026-08-27','2026-08-08',1),
  ('47a5fb3c-2ea9-49ed-a084-3111f5a191d1','2026-08-15','2026-07-24',1),  -- Chervil
  ('47a5fb3c-2ea9-49ed-a084-3111f5a191d1','2026-08-22','2026-07-31',1),
  ('47a5fb3c-2ea9-49ed-a084-3111f5a191d1','2026-08-29','2026-08-07',1),
  ('47a5fb3c-2ea9-49ed-a084-3111f5a191d1','2026-09-05','2026-08-14',1),
  ('4c51aacc-ed86-417c-8619-6a8ce81f1808','2026-08-15','2026-07-23',1),  -- Fennel
  ('4c51aacc-ed86-417c-8619-6a8ce81f1808','2026-08-22','2026-07-30',1),
  ('4c51aacc-ed86-417c-8619-6a8ce81f1808','2026-08-29','2026-08-06',1),
  ('4c51aacc-ed86-417c-8619-6a8ce81f1808','2026-09-05','2026-08-13',1),
  ('e53f2a0c-bb4e-4ee7-87ff-ed20a2f99217','2026-08-24','2026-08-11',1),  -- Kale
  ('3f408b8c-8b80-4ee8-8067-0b89fc56e519','2026-08-15','2026-07-31',2),  -- Mustard
  ('3f408b8c-8b80-4ee8-8067-0b89fc56e519','2026-08-22','2026-08-07',1),
  ('ecc972b8-d9b4-4677-a820-70fde2bbcc1f','2026-08-20','2026-08-05',2),  -- Pea (Frilly)
  ('ecc972b8-d9b4-4677-a820-70fde2bbcc1f','2026-08-27','2026-08-12',2),
  ('91ead4a4-2a7b-49c3-8797-1d248be6534d','2026-08-17','2026-07-19',2),  -- Shiso (Purple)
  ('91ead4a4-2a7b-49c3-8797-1d248be6534d','2026-08-24','2026-07-26',2),
  ('91ead4a4-2a7b-49c3-8797-1d248be6534d','2026-08-31','2026-08-02',2)
)
update farm_tasks t
   set status            = 'open',
       superseded_at     = null,
       superseded_reason = null,
       due_date          = p.sow_date,
       priority          = 1,
       title             = 'Sow ' || p.trays || ' tray'
                           || case when p.trays = 1 then '' else 's' end || ' ' || c.name,
       description       = 'For delivery ' || p.delivery_date || '. Demand: ' || p.trays || ' LG.',
       source_ref        = jsonb_build_object(
                             'crop_id', p.crop_id,
                             'delivery_date', p.delivery_date::text,
                             'trays_to_sow', p.trays,
                             'trays_needed', p.trays,
                             'trays_in_flight', 0,
                             'expected_demands',
                               jsonb_build_array(jsonb_build_object('quantity', p.trays, 'unit', 'lg'))),
       item_id           = c.item_id,
       updated_at        = now()
  from plan p
  join microgreen_crops c on c.id = p.crop_id
 where t.generator_key = 'mg:sow:' || p.crop_id || ':' || p.delivery_date
   and t.status = 'superseded';
