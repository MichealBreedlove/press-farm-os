-- 075_microgreens_clear_overdue_and_pea_variety.sql
--
-- Data-only migration, follow-up to 074. Two fixes Micheal asked for:
--   1. Clear the overdue microgreens backlog (22 tasks, back to 2026-07-19).
--   2. Point the Pea demand at the variety he actually grows (Calvin, not Frilly).
--
-- Manual farm_tasks are NOT touched — every statement here is scoped to
-- source = 'microgreens-auto' or to microgreen_demand.

-- ---------------------------------------------------------------------------
-- 1. Cancel the overdue backlog.
--
--    'cancelled' rather than 'superseded' is deliberate — it's what makes the
--    clear stick against the nightly cron. In regenerateMicrogreensTasks():
--      - the insert uses ON CONFLICT (generator_key) DO NOTHING, so these rows
--        block re-creation of the same key;
--      - reopenSupersededTasks() only resurrects status = 'superseded';
--      - the supersession pass only touches status = 'open'.
--    A 'superseded' row would be reopened by the next cron run; a cancelled one
--    stays gone, which is the intent. It also matches what the Cancel button in
--    /admin/tasks writes (src/app/api/tasks/[id]/cancel/route.ts).
--
--    Scoped by due_date so anything still actionable stays on the board.
-- ---------------------------------------------------------------------------
update farm_tasks
   set status           = 'cancelled',
       completion_notes = 'Cleared 2026-08-15 — overdue sow window, backlog reset',
       updated_at       = now()
 where source   = 'microgreens-auto'
   and status   = 'open'
   and due_date < date '2026-08-15';

-- ---------------------------------------------------------------------------
-- 2. Pea demand: Frilly -> Calvin.
--
--    Both demand rows (Press + Under-Study, "Pea tendrils - 1 tray/wk") pointed
--    at Pea (Frilly) while Micheal grows Pea (Calvin) — so the 5 Calvin trays
--    sown 2026-08-14 never counted against demand and the board asked for Pea
--    he already had going.
--
--    effective_from is set past the 2026-08-27 delivery on purpose. Pea demand
--    lands on Thursdays and Calvin's ideal_harvest_day is 15, so the sow windows
--    for the 08-20 and 08-27 deliveries (08-05 and 08-12) have already closed —
--    without this, step 1's clear would be undone the moment the cron recomputed
--    the plan under the new crop_id. The first delivery it now plans is 09-03,
--    whose sow date (08-19) is still ahead. interval_weeks is 1, so using
--    effective_from as the recurrence anchor changes nothing.
-- ---------------------------------------------------------------------------
update microgreen_demand
   set crop_id        = 'f26833aa-09bd-4ceb-95fb-0b95e52b282c',  -- Pea (Calvin)
       effective_from = date '2026-08-28',
       notes          = notes || ' — variety: Calvin (was Frilly, corrected 2026-08-15)',
       updated_at     = now()
 where crop_id = 'ecc972b8-d9b4-4677-a820-70fde2bbcc1f';         -- Pea (Frilly)

-- ---------------------------------------------------------------------------
-- 3. Tombstone the one genuinely unrecoverable sow.
--
--    Shiso (Purple) for the 2026-09-07 delivery needed sowing on 2026-08-09 —
--    six days before this migration. Raising PLAN_HORIZON_DAYS to 35 (see
--    src/lib/microgreens/constants.ts) stops long-lead crops from generating
--    permanently-late tasks going forward, but this one delivery is already
--    past saving, so the next cron run would drop a fresh overdue task onto the
--    board we just cleared.
--
--    Pre-creating the row as 'cancelled' claims the generator_key, so the
--    cron's ON CONFLICT DO NOTHING skips it. OPERATIONAL CONSEQUENCE: Press +
--    Under-Study are 2 LG short of Shiso on 2026-09-07 unless substituted.
-- ---------------------------------------------------------------------------
insert into farm_tasks
  (farm_id, title, description, type, source, source_ref, generator_key,
   due_date, priority, status, microgreen_crop_id, item_id, completion_notes)
select '5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d',
       'Sow 2 trays Shiso',
       'For delivery 2026-09-07. Demand: 2 LG.',
       'sow', 'microgreens-auto',
       jsonb_build_object(
         'crop_id', c.id, 'delivery_date', '2026-09-07',
         'trays_to_sow', 2, 'trays_needed', 2, 'trays_in_flight', 0,
         'expected_demands', jsonb_build_array(jsonb_build_object('quantity', 2, 'unit', 'lg'))),
       'mg:sow:' || c.id || ':2026-09-07',
       date '2026-08-09', 1, 'cancelled', c.id, c.item_id,
       'Cleared 2026-08-15 — sow window closed 2026-08-09, delivery cannot be met'
  from microgreen_crops c
 where c.id = '91ead4a4-2a7b-49c3-8797-1d248be6534d'
on conflict (generator_key) do nothing;
