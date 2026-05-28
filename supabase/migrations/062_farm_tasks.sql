-- Migration 062: Farm Tasks — unified automated operations list
--
-- Introduces a single `farm_tasks` table that all task sources write into:
--   - microgreens-auto    cron-generated from the existing sow plan algorithm
--   - recurring-item      cron-generated from per-item recurring schedules
--   - inbox-confirmed     materialized from inbox_task_drafts after user confirm
--   - manual              ad-hoc tasks created directly from /admin/tasks
--
-- Generators are idempotent via `generator_key UNIQUE`. Re-running cron does
-- not duplicate rows; instead it inserts new keys and supersedes orphaned
-- ones (status='superseded') so history is preserved without ghost tasks.
--
-- Also:
--   - Adds recurring_sow_* columns to items (per-item recurring engine).
--   - Adds inbox_task_drafts table (LLM-proposed schedules awaiting confirm).
--   - Adds slide_recurring_anchor trigger so completing a recurring task
--     advances the item's next-sow anchor to the actual sow date.
--   - Drops orphaned planting_tasks table (from migration 014, never wired
--     into any admin UI; superseded by farm_tasks).

-- ─── Enums ─────────────────────────────────────────────────────────────

CREATE TYPE farm_task_source AS ENUM (
  'manual',
  'microgreens-auto',
  'recurring-item',
  'inbox-confirmed'
);

CREATE TYPE farm_task_type AS ENUM (
  'sow',
  'transplant',
  'harvest',
  'terminate',
  'maintenance',
  'inventory',
  'delivery-prep',
  'chef-request',
  'custom'
);

CREATE TYPE farm_task_status AS ENUM (
  'open',
  'completed',
  'superseded',
  'cancelled',
  'snoozed'
);

-- ─── farm_tasks ────────────────────────────────────────────────────────

CREATE TABLE farm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,

  title text NOT NULL,
  description text,
  type farm_task_type NOT NULL,
  source farm_task_source NOT NULL,
  source_ref jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Idempotency key for generators. NULL for manual + inbox-confirmed tasks.
  generator_key text UNIQUE,

  due_date date NOT NULL,
  due_time time,
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),

  status farm_task_status NOT NULL DEFAULT 'open',
  snoozed_until date,
  completed_at timestamptz,
  superseded_at timestamptz,
  superseded_reason text,
  completion_notes text,

  -- Linkage (denormalized FKs for fast filtering; nullable)
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  microgreen_crop_id uuid REFERENCES microgreen_crops(id) ON DELETE SET NULL,
  microgreen_batch_id uuid REFERENCES microgreen_batches(id) ON DELETE SET NULL,
  inbound_message_id uuid REFERENCES inbound_messages(id) ON DELETE SET NULL,
  suggestion_id uuid REFERENCES suggestions(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX farm_tasks_today_idx
  ON farm_tasks (farm_id, due_date, status)
  WHERE status = 'open';

CREATE INDEX farm_tasks_calendar_idx
  ON farm_tasks (farm_id, due_date)
  WHERE status IN ('open', 'completed');

CREATE INDEX farm_tasks_source_status_idx
  ON farm_tasks (source, status)
  WHERE status = 'open';

ALTER TABLE farm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to farm_tasks"
  ON farm_tasks FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE TRIGGER update_farm_tasks_updated_at
  BEFORE UPDATE ON farm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── items recurrence columns ──────────────────────────────────────────

ALTER TABLE items
  ADD COLUMN IF NOT EXISTS recurring_sow_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_sow_interval_days integer
    CHECK (recurring_sow_interval_days IS NULL OR recurring_sow_interval_days > 0),
  ADD COLUMN IF NOT EXISTS recurring_sow_anchor_date date,
  ADD COLUMN IF NOT EXISTS recurring_sow_notes text;

-- ─── inbox_task_drafts ─────────────────────────────────────────────────

CREATE TABLE inbox_task_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_message_id uuid NOT NULL REFERENCES inbound_messages(id) ON DELETE CASCADE,
  suggestion_id uuid REFERENCES suggestions(id) ON DELETE SET NULL,

  proposed_item_name text NOT NULL,
  matched_item_id uuid REFERENCES items(id) ON DELETE SET NULL,

  -- [{ task_type, offset_days_from_today, title, description }]
  proposed_schedule jsonb NOT NULL,

  reasoning text,
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'dismissed', 'edited')),
  confirmed_at timestamptz,
  dismissed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inbox_task_drafts_pending_idx
  ON inbox_task_drafts (status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX inbox_task_drafts_inbound_idx
  ON inbox_task_drafts (inbound_message_id);

ALTER TABLE inbox_task_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to inbox_task_drafts"
  ON inbox_task_drafts FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE TRIGGER update_inbox_task_drafts_updated_at
  BEFORE UPDATE ON inbox_task_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── Recurring anchor slide trigger ────────────────────────────────────
--
-- When a recurring-item task is completed, advance the item's anchor to the
-- task's due_date. This means the next sow is scheduled from when you
-- actually sowed, not from the original anchor — missed cycles don't snowball.
--
-- Only slides forward (never backward) so out-of-order completions don't
-- rewind the schedule.

CREATE OR REPLACE FUNCTION public.slide_recurring_anchor()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.source = 'recurring-item'
     AND NEW.item_id IS NOT NULL THEN
    UPDATE items
      SET recurring_sow_anchor_date = NEW.due_date,
          updated_at = now()
      WHERE id = NEW.item_id
        AND (recurring_sow_anchor_date IS NULL
             OR recurring_sow_anchor_date < NEW.due_date);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER slide_anchor_on_complete
  AFTER UPDATE ON farm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.slide_recurring_anchor();

-- ─── Drop orphaned planting_tasks ──────────────────────────────────────
-- From migration 014. Never wired into any admin UI; superseded by farm_tasks
-- with type IN ('sow','transplant','harvest','terminate') + item_id linkage.

DROP TABLE IF EXISTS planting_tasks CASCADE;

-- ─── Revoke PostgREST grants on the new trigger function ───────────────
-- Trigger functions don't need to be RPC-callable. Pattern from migration 043.

REVOKE EXECUTE ON FUNCTION public.slide_recurring_anchor() FROM PUBLIC, anon, authenticated;
