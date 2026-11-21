-- 105: A farm task can be assigned to several people
--
-- `farm_tasks.assignee_ids uuid[]` is now the source of truth for who a task
-- belongs to. Empty = resolved in code (src/lib/tasks/assign.ts): automated
-- tasks fall to the farm owner, a manual task is for anyone. `assigned_to`
-- (migration 101) is kept in step as the FIRST assignee so older readers
-- keep working. Each step of a multi-step task has its own assignees.
--
-- Additive; backfilled from assigned_to. Applied 2026-11-21 via the
-- Supabase MCP. Rollback: ALTER TABLE farm_tasks DROP COLUMN assignee_ids;

ALTER TABLE farm_tasks ADD COLUMN IF NOT EXISTS assignee_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE farm_tasks SET assignee_ids = ARRAY[assigned_to]
WHERE assigned_to IS NOT NULL AND assignee_ids = '{}';
