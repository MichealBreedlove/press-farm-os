# Farm Tasks — comprehensive automated operations list

**Date**: 2026-05-27
**Author**: Micheal Breedlove + Claude
**Status**: Approved — ready for implementation

## Goal

Replace ad-hoc memory with a single, automated task list that surfaces what
needs sowing, transplanting, harvesting, or otherwise doing on any given day,
pulling from three sources: the existing microgreens demand engine, per-item
recurring sow schedules, and chef requests captured via the inbound email
pipeline.

The user wants this comprehensive — "a bit overkill, but highly automated."

## Non-goals

- Reminders via web push / SMS / external channel (in-app badge + Today widget
  only for v1; revisit if needed).
- Multi-user task assignment. Admin-only for v1.
- Recurring schedules for non-crop chores (greenhouse cleanup, equipment
  maintenance). The recurring engine is per-item only.
- Replacing the existing `crop_plan_entries` planning view. Tasks are
  operational; crop plan is strategic. They coexist.

## Architecture

**Approach: materialize + supersede.** Cron-driven generators write rows into
a unified `farm_tasks` table. When inputs change (demand reduced, item
deactivated, sow plan recomputed), the next cron run marks orphaned open tasks
as `superseded` rather than deleting them. Reads are dumb `SELECT` against the
table.

## Data model

### `farm_tasks` (new)

```sql
CREATE TYPE farm_task_source AS ENUM (
  'manual', 'microgreens-auto', 'recurring-item', 'inbox-confirmed'
);

CREATE TYPE farm_task_type AS ENUM (
  'sow', 'transplant', 'harvest', 'terminate', 'maintenance',
  'inventory', 'delivery-prep', 'chef-request', 'custom'
);

CREATE TYPE farm_task_status AS ENUM (
  'open', 'completed', 'superseded', 'cancelled', 'snoozed'
);

CREATE TABLE farm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,

  -- Identity
  title text NOT NULL,
  description text,
  type farm_task_type NOT NULL,
  source farm_task_source NOT NULL,
  source_ref jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Idempotency: cron computes the same key on every run.
  -- INSERT ... ON CONFLICT (generator_key) DO NOTHING prevents duplicates.
  generator_key text UNIQUE,

  -- Scheduling
  due_date date NOT NULL,
  due_time time,
  priority smallint NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 4),

  -- Lifecycle
  status farm_task_status NOT NULL DEFAULT 'open',
  snoozed_until date,
  completed_at timestamptz,
  superseded_at timestamptz,
  superseded_reason text,
  completion_notes text,

  -- Linkage (denormalized FKs for fast filtering)
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

ALTER TABLE farm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin full access to farm_tasks"
  ON farm_tasks FOR ALL
  USING (private.is_admin())
  WITH CHECK (private.is_admin());
```

`source_ref` schema by source:
- `microgreens-auto`: `{ crop_id, batch_id?, delivery_date, trays_to_sow, expected_demands }`
- `recurring-item`: `{ item_id, recurrence_anchor_date }`
- `inbox-confirmed`: `{ inbound_message_id, suggestion_id?, item_id?, draft_id }`
- `manual` / `custom`: `{}`

### `items` recurrence columns (new)

```sql
ALTER TABLE items
  ADD COLUMN recurring_sow_active boolean NOT NULL DEFAULT false,
  ADD COLUMN recurring_sow_interval_days integer
    CHECK (recurring_sow_interval_days IS NULL OR recurring_sow_interval_days > 0),
  ADD COLUMN recurring_sow_anchor_date date,
  ADD COLUMN recurring_sow_notes text;
```

`recurring_sow_anchor_date` is the **last known sow date**. Each completed
`recurring-item` task advances the anchor to its `due_date`, so missed cycles
do not snowball: the next sow is always `interval_days` after the most recent
actual sow.

### `inbox_task_drafts` (new)

```sql
CREATE TABLE inbox_task_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbound_message_id uuid NOT NULL REFERENCES inbound_messages(id) ON DELETE CASCADE,
  suggestion_id uuid REFERENCES suggestions(id) ON DELETE SET NULL,

  proposed_item_name text NOT NULL,
  matched_item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  proposed_schedule jsonb NOT NULL,
    -- [{ task_type, offset_days_from_today, title, description }]
  reasoning text,
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'dismissed', 'edited')),
  confirmed_at timestamptz,
  dismissed_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Retired

- `planting_tasks` (migration 014) — orphaned, no consumers. Dropped in same
  migration. Use cases now handled by `farm_tasks.type IN ('sow','transplant',
  'harvest','terminate')` + `item_id`.

## Generators

### Microgreens auto-generator

Wraps existing `computeSowPlan()` in `src/lib/microgreens/sowPlan.ts`.

```
for each upcoming delivery date in PLAN_HORIZON_DAYS (currently 21):
  run computeSowPlan(...)
  for each SowTask → upsert farm_tasks row:
    generator_key = 'mg:sow:<crop_id>:<delivery_date>'
    type = 'sow'
    due_date = sow_task.sow_date
    priority = 1 if today, else 2
  for each AdvanceTask → upsert:
    generator_key = 'mg:advance:<tray_id>:<to_status>'
    type = 'maintenance'
  for each HarvestTask → upsert:
    generator_key = 'mg:harvest:<tray_id>:<sow_date>'
    type = 'harvest'

supersession pass:
  collect all generator_keys produced this run
  UPDATE farm_tasks SET status='superseded', superseded_at=now(),
    superseded_reason='no longer in sow plan'
  WHERE source='microgreens-auto'
    AND status='open'
    AND generator_key NOT IN (this_run_keys)
```

### Recurring per-item generator

```
for each item where recurring_sow_active = true:
  next = max(recurring_sow_anchor_date, today)
  while next <= today + 30:
    upsert farm_tasks row with generator_key = 'rec:<item_id>:<next>'
    next = next + interval_days

supersession pass: same pattern, scoped to source='recurring-item'.
```

### Inbox draft generator

Extends `src/lib/extraction/item-requests.ts`. After suggestions are written,
a second Haiku 4.5 call per suggestion produces a draft schedule. Schema:

```ts
{
  matched_item_id: string | null,
  proposed_schedule: Array<{
    task_type: 'sow' | 'transplant' | 'harvest' | 'maintenance',
    offset_days_from_today: number,
    title: string,
    description: string,
  }>,
  reasoning: string,
  confidence: 'high' | 'medium' | 'low',
}
```

Writes `inbox_task_drafts` row. Nothing in `farm_tasks` until the user
confirms via UI. Low-confidence drafts route to a "Needs review" sub-bucket
in the Drafts tab.

### Manual generator

`/admin/tasks/new` form. No `generator_key`. Editable type, date, optional
crop/item link.

## Triggers

```sql
CREATE OR REPLACE FUNCTION slide_recurring_anchor()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed'
     AND OLD.status != 'completed'
     AND NEW.source = 'recurring-item'
     AND NEW.item_id IS NOT NULL THEN
    UPDATE items
      SET recurring_sow_anchor_date = NEW.due_date
      WHERE id = NEW.item_id
        AND (recurring_sow_anchor_date IS NULL
             OR recurring_sow_anchor_date < NEW.due_date);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER slide_anchor_on_complete
  AFTER UPDATE ON farm_tasks
  FOR EACH ROW EXECUTE FUNCTION slide_recurring_anchor();
```

## API routes

```
src/app/api/tasks/
  route.ts                  GET (list), POST (create manual)
  [id]/route.ts             GET, PATCH (edit), DELETE
  [id]/complete/route.ts    POST
  [id]/cancel/route.ts      POST
  [id]/snooze/route.ts      POST { until_date }
  drafts/route.ts           GET pending drafts
  drafts/[id]/confirm/route.ts  POST → batch insert into farm_tasks
  drafts/[id]/edit/route.ts     PATCH proposed_schedule
  drafts/[id]/dismiss/route.ts  POST
  regenerate/route.ts       POST — manual cron trigger

src/app/api/cron/
  tasks-regenerate/route.ts GET — Vercel cron, header-secret protected
```

## Cron

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/tasks-regenerate", "schedule": "0 9 * * *" }
  ]
}
```

`0 9 * * *` = 09:00 UTC = 02:00 PT. Handler calls
`regenerateMicrogreensTasks` then `regenerateRecurringItemTasks` sequentially,
each returning `{ generated, superseded }` for logging.

## UI surfaces

### `/admin/tasks` (new top-level)

EditorialHero (eyebrow="Operations", title="Tasks", flower="borage").
Bottom-nav badge with open-task count.

Tab strip:
- **Today**: `due_date ≤ today AND status='open'`. Sorted priority asc,
  due_time, created_at.
- **Upcoming**: `due_date > today AND ≤ today+30`. Grouped by date.
- **Drafts**: pending `inbox_task_drafts`. "Needs review" (low confidence)
  segment above "Suggested" (med/high).
- **Done**: `completed_at >= today-30d`.
- **All sources**: filter chips by source.

Task row: checkbox, type icon, title, subtitle (linked crop/item, due time),
badges (source, priority, overdue). Tap → modal with description +
completion notes.

Swipe gestures (hand-rolled `useSwipe` hook, no new dep):
- Swipe right: complete
- Swipe left: snooze (1d / 3d / 1w)
- Long-press: cancel

Bulk actions at top: complete all selected, snooze all, "Regenerate now"
(calls `/api/tasks/regenerate` so changes to demand reflect immediately).

### Dashboard widget

`/admin/dashboard` adds a "Today" card below the weather widget. Up to 6
highest-priority open tasks due today. "View all" → `/admin/tasks`. Empty
state: small flower + "Nothing due today. Nice."

### Bottom-nav badge

`src/components/shared/BottomNav.tsx` gains a numeric badge when
`count(open tasks where due_date ≤ today) > 0`. Server component computes;
client renders. New "Tasks" slot likely replaces "Settings" (Settings moves
to a header menu) — confirmed at implementation time.

### Inbox enhancements

`/admin/inbox/[id]` gains a "Proposed tasks" section below the existing
suggestions list. Each card shows the proposed schedule, reasoning,
confidence chip, and [Confirm] / [Edit] / [Dismiss] buttons.

Edit opens a modal with editable date/title fields per row. Confirm
batch-inserts into `farm_tasks` in one transaction with
`source='inbox-confirmed'`.

### Item editor

`/admin/items/[itemId]` gains a "Recurring sow" collapsible section:
checkbox to activate, interval (days), anchor date, notes. Inline preview:
"Next 3 sows: …".

## Tests

- `src/lib/tasks/regenerator.test.ts`:
  - Microgreens regenerator idempotency (two runs = same row count).
  - Supersession: changing demand → next run marks orphans `superseded`.
  - Recurring item: anchor slides on completion.
  - Recurring item: deactivating item supersedes future open tasks.
  - Recurring item: correct count within 30d window.
- `src/lib/extraction/task-schedule.test.ts`:
  - Mocked Anthropic SDK, draft row shape correct.
  - Offset-to-absolute-date conversion happens at confirm-time, not draft-time.

## Migration

Single file: `supabase/migrations/062_farm_tasks.sql`. Statements in order:

1. Create enums.
2. Create `farm_tasks` + indexes + RLS + `updated_at` trigger.
3. Add `items.recurring_sow_*` columns.
4. Create `inbox_task_drafts` + indexes + RLS + trigger.
5. Create `slide_recurring_anchor` function + trigger.
6. `DROP TABLE planting_tasks CASCADE`.
7. Revoke EXECUTE on the new trigger function from PUBLIC / anon / authenticated
   (per migration 043 pattern).

Micheal runs in Supabase web SQL editor. Code is written to tolerate the
migration not being applied — every query against new tables/columns is
wrapped in try/catch returning empty state.

## Failure semantics

- Cron failure: Vercel cron retries on next schedule; idempotent so no harm.
- LLM draft failure: extraction sets `extraction_status='failed'`, no draft
  row inserted, inbound message remains visible for manual review.
- Migration not applied + code deployed: pages render empty-state instead of
  crashing.
- User edits a recurring item's interval: takes effect next cron run, no
  retroactive change to existing open tasks.
- User completes a microgreens-auto task that was about to be superseded:
  completion wins, supersession skips (uses `WHERE status='open'`).

## Sequencing (single commit / push)

1. Migration file written, presented to Micheal.
2. Types in `src/types/database.ts`.
3. Lib: regenerator, task-schedule extraction.
4. API routes.
5. UI: tasks page → widget → inbox cards → item editor → nav badge.
6. Tests.
7. `npm run build` → commit → push to main → Vercel deploys.
