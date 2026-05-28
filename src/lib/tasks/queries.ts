/**
 * Read-side helpers for the tasks UI. All return plain rows, no enrichment;
 * the page-level loaders attach related crop/item names as needed.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { todayIso, addDays } from "./dates";
import type { FarmTask, InboxTaskDraft } from "@/types/database";

type AdminClient = ReturnType<typeof createAdminClient>;

const TASK_COLUMNS =
  "id, farm_id, title, description, type, source, source_ref, generator_key, due_date, due_time, priority, status, snoozed_until, completed_at, superseded_at, superseded_reason, completion_notes, item_id, microgreen_crop_id, microgreen_batch_id, inbound_message_id, suggestion_id, created_at, updated_at";

export async function getOpenTaskCount(
  admin: AdminClient,
  farmId: string,
  now: Date = new Date(),
): Promise<number> {
  const today = todayIso(now);
  const { count, error } = await (admin as any)
    .from("farm_tasks")
    .select("id", { count: "exact", head: true })
    .eq("farm_id", farmId)
    .eq("status", "open")
    .lte("due_date", today);
  if (error) {
    // Schema may not be applied yet — return 0 instead of crashing nav.
    return 0;
  }
  return count ?? 0;
}

export async function listTodayTasks(
  admin: AdminClient,
  farmId: string,
  now: Date = new Date(),
): Promise<FarmTask[]> {
  const today = todayIso(now);
  const { data, error } = await (admin as any)
    .from("farm_tasks")
    .select(TASK_COLUMNS)
    .eq("farm_id", farmId)
    .eq("status", "open")
    .lte("due_date", today)
    .order("priority", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as FarmTask[];
}

export async function listUpcomingTasks(
  admin: AdminClient,
  farmId: string,
  now: Date = new Date(),
  horizonDays: number = 30,
): Promise<FarmTask[]> {
  const today = todayIso(now);
  const horizon = addDays(today, horizonDays);
  const { data, error } = await (admin as any)
    .from("farm_tasks")
    .select(TASK_COLUMNS)
    .eq("farm_id", farmId)
    .eq("status", "open")
    .gt("due_date", today)
    .lte("due_date", horizon)
    .order("due_date", { ascending: true })
    .order("priority", { ascending: true });
  if (error) return [];
  return (data ?? []) as FarmTask[];
}

export async function listCompletedTasks(
  admin: AdminClient,
  farmId: string,
  now: Date = new Date(),
  lookbackDays: number = 30,
): Promise<FarmTask[]> {
  const since = addDays(todayIso(now), -lookbackDays);
  const { data, error } = await (admin as any)
    .from("farm_tasks")
    .select(TASK_COLUMNS)
    .eq("farm_id", farmId)
    .eq("status", "completed")
    .gte("completed_at", `${since}T00:00:00Z`)
    .order("completed_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []) as FarmTask[];
}

export async function listPendingDrafts(
  admin: AdminClient,
): Promise<InboxTaskDraft[]> {
  const { data, error } = await (admin as any)
    .from("inbox_task_drafts")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as InboxTaskDraft[];
}
