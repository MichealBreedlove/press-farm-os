-- 101: Assign farm tasks to a person
--
-- `farm_tasks.assigned_to` → profiles. Micheal picks the person on the
-- new / edit task forms; the Farm Hand, Receiver and Farm Liaison task
-- views show who each task belongs to.
--
-- NULL is meaningful and is resolved in code (src/lib/tasks/assign.ts):
--   - automated tasks (microgreens-auto, recurring-item, inbox-confirmed)
--     with no explicit assignee belong to the farm owner (the admin) — so
--     the nightly generators need no change and never have to know an id;
--   - a manual task with no assignee is for anyone on the farm team.
-- Setting the column on any task (automated ones included) overrides that.
--
-- Additive only. Applied 2026-11-21 via the Supabase MCP.
-- Rollback: ALTER TABLE farm_tasks DROP COLUMN assigned_to;

ALTER TABLE farm_tasks
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL;
