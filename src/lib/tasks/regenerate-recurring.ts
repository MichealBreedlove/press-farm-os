/**
 * Materialize per-item recurring sow schedules into farm_tasks.
 *
 * For each item with recurring_sow_active=true and a positive interval,
 * generate sow tasks within RECURRING_HORIZON_DAYS (30) of today, anchored
 * at recurring_sow_anchor_date.
 *
 * Anchor semantics: anchor is the LAST KNOWN sow date. Next sow = anchor +
 * interval. On completion of a recurring task the DB trigger
 * slide_recurring_anchor() advances the item's anchor to the task's due_date,
 * so missed cycles don't pile up: tomorrow's task is always interval days
 * after the most recent sow.
 *
 * Idempotent via generator_key = 'rec:<item_id>:<sow_date>'.
 *
 * Supersession: any open recurring-item task whose key was not produced
 * this run is marked superseded. This fires when:
 *   - The item's recurring_sow_active flips to false.
 *   - The interval changes such that a previously-scheduled date no longer falls
 *     on the new cadence.
 *   - The anchor jumps forward past existing scheduled dates.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, todayIso } from "./dates";
import { RECURRING_HORIZON_DAYS } from "./constants";
import type { RegenerateResult } from "./regenerate-microgreens";
import { reopenSupersededTasks } from "./reopen";

type AdminClient = ReturnType<typeof createAdminClient>;

interface RecurringItem {
  id: string;
  farm_id: string;
  name: string;
  recurring_sow_active: boolean;
  recurring_sow_interval_days: number | null;
  recurring_sow_anchor_date: string | null;
  recurring_sow_notes: string | null;
}

interface RecurringTaskRow {
  farm_id: string;
  title: string;
  description: string | null;
  type: "sow";
  source: "recurring-item";
  source_ref: Record<string, unknown>;
  generator_key: string;
  due_date: string;
  priority: 1 | 2;
  status: "open";
  item_id: string;
}

export function computeRecurringSowDates(
  anchor: string | null,
  intervalDays: number,
  today: string,
  horizonDays: number = RECURRING_HORIZON_DAYS,
): string[] {
  if (intervalDays <= 0) return [];
  const horizonEnd = addDays(today, horizonDays);

  // First candidate: anchor + interval (anchor is the last sow date itself,
  // not the next). If no anchor yet, the first cycle is today.
  let next: string = anchor ? addDays(anchor, intervalDays) : today;

  // Fast-forward past dates: if anchor + N*interval is still in the past,
  // skip forward until we land on or after today.
  while (next < today) {
    next = addDays(next, intervalDays);
  }

  const dates: string[] = [];
  while (next <= horizonEnd) {
    dates.push(next);
    next = addDays(next, intervalDays);
  }
  return dates;
}

export async function regenerateRecurringItemTasks(
  admin: AdminClient,
  farmId: string,
  now: Date = new Date(),
): Promise<RegenerateResult> {
  const today = todayIso(now);

  const { data: items, error: itemsErr } = await (admin as any)
    .from("items")
    .select(
      "id, farm_id, name, recurring_sow_active, recurring_sow_interval_days, recurring_sow_anchor_date, recurring_sow_notes",
    )
    .eq("farm_id", farmId)
    .eq("recurring_sow_active", true)
    .not("recurring_sow_interval_days", "is", null);

  if (itemsErr) {
    console.error("[TASKS] recurring items fetch failed", itemsErr);
    return { generated: 0, inserted: 0, reopened: 0, superseded: 0 };
  }

  const rows: RecurringTaskRow[] = [];

  for (const item of (items ?? []) as RecurringItem[]) {
    if (!item.recurring_sow_interval_days || item.recurring_sow_interval_days <= 0) continue;
    const dates = computeRecurringSowDates(
      item.recurring_sow_anchor_date,
      item.recurring_sow_interval_days,
      today,
    );
    for (const sowDate of dates) {
      rows.push({
        farm_id: item.farm_id,
        title: `Sow ${item.name} (recurring every ${item.recurring_sow_interval_days}d)`,
        description: item.recurring_sow_notes ?? null,
        type: "sow",
        source: "recurring-item",
        source_ref: {
          item_id: item.id,
          interval_days: item.recurring_sow_interval_days,
          recurrence_anchor_date: item.recurring_sow_anchor_date,
        },
        generator_key: `rec:${item.id}:${sowDate}`,
        due_date: sowDate,
        priority: sowDate <= today ? 1 : 2,
        status: "open",
        item_id: item.id,
      });
    }
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { data: insertedRows, error } = await (admin as any)
      .from("farm_tasks")
      .upsert(rows, { onConflict: "generator_key", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error("[TASKS] recurring upsert failed", error);
    } else {
      inserted = insertedRows?.length ?? 0;
    }
  }

  const activeKeys = rows.map((r) => r.generator_key);

  // Resurrection pass — see reopenSupersededTasks(). Runs before supersession.
  const reopened = await reopenSupersededTasks(admin, "recurring-item", activeKeys);

  // Supersession pass.
  let superseded = 0;
  if (activeKeys.length > 0) {
    const { data: supRows, error: supErr } = await (admin as any)
      .from("farm_tasks")
      .update({
        status: "superseded",
        superseded_at: new Date().toISOString(),
        superseded_reason: "no longer in recurring schedule",
      })
      .eq("source", "recurring-item")
      .eq("status", "open")
      .not("generator_key", "in", `(${activeKeys.join(",")})`)
      .select("id");
    if (!supErr) superseded = supRows?.length ?? 0;
  } else {
    const { data: supRows, error: supErr } = await (admin as any)
      .from("farm_tasks")
      .update({
        status: "superseded",
        superseded_at: new Date().toISOString(),
        superseded_reason: "no active recurring items",
      })
      .eq("source", "recurring-item")
      .eq("status", "open")
      .select("id");
    if (!supErr) superseded = supRows?.length ?? 0;
  }

  return { generated: rows.length, inserted, reopened, superseded };
}
