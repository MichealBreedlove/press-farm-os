import { randomUUID } from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { todayPacific } from "@/lib/utils";
import { nextStageDueDate, planStageDates, type StageInput } from "./stages";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Lowest open stage_index per chain, for the given chain ids. */
export async function lowestOpenStages(
  admin: AdminClient,
  groupIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (groupIds.length === 0) return map;
  const { data } = await (admin as any)
    .from("farm_tasks")
    .select("stage_group_id, stage_index")
    .in("stage_group_id", groupIds)
    .in("status", ["open", "snoozed"]);
  for (const r of (data ?? []) as { stage_group_id: string; stage_index: number }[]) {
    const cur = map.get(r.stage_group_id);
    if (cur === undefined || r.stage_index < cur) map.set(r.stage_group_id, r.stage_index);
  }
  return map;
}

/** Number of steps in each chain. */
export async function stageCounts(admin: AdminClient, groupIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (groupIds.length === 0) return map;
  const { data } = await (admin as any)
    .from("farm_tasks")
    .select("stage_group_id, stage_index")
    .in("stage_group_id", groupIds)
    .neq("status", "cancelled");
  for (const r of (data ?? []) as { stage_group_id: string; stage_index: number }[]) {
    map.set(r.stage_group_id, Math.max(map.get(r.stage_group_id) ?? 0, r.stage_index));
  }
  return map;
}

/**
 * Appends steps after `parent`'s chain (turning a plain task into step 1 of
 * a chain if needed). The new steps copy the parent's type, priority,
 * assignee and linked item. Returns the inserted rows.
 */
export async function appendStages(
  admin: AdminClient,
  parent: {
    id: string;
    farm_id: string;
    type: string;
    priority: number;
    assigned_to: string | null;
    assignee_ids?: string[] | null;
    location_place?: string | null;
    location_quadrant?: number | null;
    location_rows?: string | null;
    item_id: string | null;
    due_date: string;
    stage_group_id: string | null;
    stage_index: number | null;
  },
  stages: StageInput[],
): Promise<{ rows: any[]; error: unknown }> {
  if (stages.length === 0) return { rows: [], error: null };

  let groupId = parent.stage_group_id;
  if (!groupId) {
    groupId = randomUUID();
    const { error } = await (admin as any)
      .from("farm_tasks")
      .update({ stage_group_id: groupId, stage_index: 1 })
      .eq("id", parent.id);
    if (error) return { rows: [], error };
  }

  // Continue after the LAST step of the chain, from its date.
  const { data: tail } = await (admin as any)
    .from("farm_tasks")
    .select("stage_index, due_date")
    .eq("stage_group_id", groupId)
    .order("stage_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastIndex: number = tail?.stage_index ?? parent.stage_index ?? 1;
  const lastDue: string = tail?.due_date ?? parent.due_date;

  const dates = planStageDates(lastDue, stages);
  const rows = stages.map((s, i) => ({
    farm_id: parent.farm_id,
    title: s.title,
    description: s.description,
    type: parent.type,
    source: "manual",
    due_date: dates[i],
    priority: parent.priority,
    // A step with its own people keeps them; otherwise it inherits step 1's.
    ...(() => {
      const ids = s.assignee_ids ?? parent.assignee_ids ?? (parent.assigned_to ? [parent.assigned_to] : []);
      return { assignee_ids: ids, assigned_to: ids[0] ?? null };
    })(),
    // A step with its own place keeps it; otherwise it is where step 1 is.
    ...(s.location ?? {
      location_place: parent.location_place ?? null,
      location_quadrant: parent.location_quadrant ?? null,
      location_rows: parent.location_rows ?? null,
    }),
    item_id: parent.item_id,
    stage_group_id: groupId,
    stage_index: lastIndex + 1 + i,
    stage_offset_days: s.offset_days,
  }));
  const { data, error } = await (admin as any).from("farm_tasks").insert(rows).select("*");
  return { rows: data ?? [], error };
}

/**
 * After a step is finished: set the real due date of the next step when it
 * is "N days after the previous step", counted from today (Pacific).
 * Best-effort — a failure leaves the provisional date in place.
 */
export async function scheduleNextStage(
  admin: AdminClient,
  finished: { stage_group_id: string | null; stage_index: number | null },
): Promise<void> {
  if (!finished.stage_group_id || finished.stage_index == null) return;
  const { data: next } = await (admin as any)
    .from("farm_tasks")
    .select("id, stage_offset_days, status")
    .eq("stage_group_id", finished.stage_group_id)
    .eq("stage_index", finished.stage_index + 1)
    .maybeSingle();
  if (!next || next.stage_offset_days == null || next.status !== "open") return;
  await (admin as any)
    .from("farm_tasks")
    .update({ due_date: nextStageDueDate(todayPacific(), next.stage_offset_days) })
    .eq("id", next.id);
}

/**
 * Removes a cancelled step from its chain and closes the gap, so the steps
 * left read 1, 2, 3 … again. The cancelled row keeps its history but no
 * longer belongs to the chain.
 */
export async function detachAndRenumber(admin: AdminClient, taskId: string): Promise<void> {
  const { data: row } = await (admin as any)
    .from("farm_tasks")
    .select("stage_group_id")
    .eq("id", taskId)
    .maybeSingle();
  const groupId: string | null = row?.stage_group_id ?? null;
  if (!groupId) return;
  await (admin as any).from("farm_tasks").update({ stage_group_id: null, stage_index: null }).eq("id", taskId);
  await renumberChain(admin, groupId);
}

/** Rewrites stage_index as 1..n in the chain's current order. */
export async function renumberChain(admin: AdminClient, groupId: string): Promise<void> {
  const { data } = await (admin as any)
    .from("farm_tasks")
    .select("id, stage_index")
    .eq("stage_group_id", groupId)
    .order("stage_index", { ascending: true });
  const rows = (data ?? []) as { id: string; stage_index: number }[];
  await Promise.all(
    rows.map((r, i) =>
      r.stage_index === i + 1
        ? null
        : (admin as any).from("farm_tasks").update({ stage_index: i + 1 }).eq("id", r.id),
    ),
  );
}

/** Swaps a step with its neighbour. Returns false when it can't move that way. */
export async function moveStage(
  admin: AdminClient,
  taskId: string,
  direction: "up" | "down",
): Promise<boolean> {
  const { data: row } = await (admin as any)
    .from("farm_tasks")
    .select("id, stage_group_id, stage_index")
    .eq("id", taskId)
    .maybeSingle();
  if (!row?.stage_group_id || row.stage_index == null) return false;
  const { data: nb } = await (admin as any)
    .from("farm_tasks")
    .select("id, stage_index")
    .eq("stage_group_id", row.stage_group_id)
    [direction === "up" ? "lt" : "gt"]("stage_index", row.stage_index)
    .order("stage_index", { ascending: direction !== "up" })
    .limit(1)
    .maybeSingle();
  if (!nb) return false;
  await Promise.all([
    (admin as any).from("farm_tasks").update({ stage_index: nb.stage_index }).eq("id", row.id),
    (admin as any).from("farm_tasks").update({ stage_index: row.stage_index }).eq("id", nb.id),
  ]);
  return true;
}

/**
 * Due date for "N days after the previous step": from the day the previous
 * step was finished, else from its own due date. A first step (no previous)
 * counts from today.
 */
export async function dueFromPreviousStep(
  admin: AdminClient,
  task: { stage_group_id: string | null; stage_index: number | null },
  offsetDays: number,
): Promise<string> {
  let base = todayPacific();
  if (task.stage_group_id && task.stage_index != null && task.stage_index > 1) {
    const { data: prev } = await (admin as any)
      .from("farm_tasks")
      .select("status, completed_at, due_date")
      .eq("stage_group_id", task.stage_group_id)
      .lt("stage_index", task.stage_index)
      .order("stage_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prev) {
      base =
        prev.status === "completed" && prev.completed_at
          ? new Date(prev.completed_at).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
          : prev.due_date;
    }
  }
  return nextStageDueDate(base, offsetDays);
}
