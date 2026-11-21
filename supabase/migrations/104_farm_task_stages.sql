-- 104: Multi-step farm tasks ("stages")
--
-- A task can be a chain of steps — e.g. 1) sow seeds in a 50-cell tray,
-- 2) 21 days later transplant them to the field. Each step is its own
-- farm_tasks row; the steps share a stage_group_id and are numbered by
-- stage_index (1, 2, 3 …).
--
--   stage_offset_days  for a step after the first: due N days after the
--                      previous step is FINISHED. Its due_date is a
--                      provisional estimate until then; finishing the
--                      previous step (POST /api/tasks/[id]/complete) sets the
--                      real date. NULL = a fixed date Micheal picked.
--
-- The Farm Hand portal (and the receiver's farm-hand board) show only the
-- CURRENT step of each chain — the lowest-numbered step still open.
-- Additive only. Applied 2026-11-21 via the Supabase MCP.
-- Rollback: DROP INDEX farm_tasks_stage_group_idx;
--   ALTER TABLE farm_tasks DROP COLUMN stage_group_id, DROP COLUMN stage_index,
--     DROP COLUMN stage_offset_days;

ALTER TABLE farm_tasks
  ADD COLUMN IF NOT EXISTS stage_group_id uuid,
  ADD COLUMN IF NOT EXISTS stage_index smallint,
  ADD COLUMN IF NOT EXISTS stage_offset_days integer CHECK (stage_offset_days IS NULL OR stage_offset_days >= 0);
CREATE INDEX IF NOT EXISTS farm_tasks_stage_group_idx ON farm_tasks (stage_group_id, stage_index) WHERE stage_group_id IS NOT NULL;
