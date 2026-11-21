import type { createAdminClient } from "@/lib/supabase/admin";
import type { FarmTask, FarmTaskType } from "@/types/database";
import { listCompletedTasks, listTodayTasks, listUpcomingTasks } from "./queries";
import { effectiveAssigneeIds, isMicrogreenTask, shortPersonName } from "./assign";
import { listTaskPeople, ownerOf } from "./people";
import { currentStagesOnly } from "./stages";
import { lowestOpenStages, stageCounts } from "./stage-server";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * A farm task as the non-admin portals see it (Farm Hand, Receiver, Farm
 * Liaison): what, when, photos, who finished it — no source refs, generator
 * keys or completion notes.
 */
export interface BoardTask {
  id: string;
  title: string;
  title_es: string | null;
  description: string | null;
  description_es: string | null;
  type: FarmTaskType;
  due_date: string;
  due_time: string | null;
  priority: 1 | 2 | 3 | 4;
  photo_urls: string[];
  completed_at: string | null;
  completed_by_name: string | null;
  /** Who the task belongs to (one or more people); empty = anyone. */
  assignee_ids: string[];
  /** Short names, same order as assignee_ids. */
  assignee_names: string[];
  /** Multi-step task: this step's number and the chain's length (else null). */
  stage_index: number | null;
  stage_count: number | null;
  /** Microgreen work — never shown to farm hands. */
  is_microgreen: boolean;
  /** Linked crop / item name, when the task has one. */
  subject: string | null;
}

export interface TaskBoard {
  /** Open and due today or earlier. */
  todo: BoardTask[];
  /** Open, due in the coming days. */
  upcoming: BoardTask[];
  /** Finished recently, newest first. */
  done: BoardTask[];
}

/**
 * Loads the farm task board for a portal page. `today` is the PACIFIC date —
 * the task query helpers default to the UTC date, which is already
 * "tomorrow" by late afternoon in California.
 */
export async function loadTaskBoard(
  admin: AdminClient,
  today: string,
  opts: {
    upcomingDays?: number;
    doneDays?: number;
    hideMicrogreens?: boolean;
    farmHandsOnly?: boolean;
    /** Only the current step of each multi-step task (farm hand / receiver). */
    currentStageOnly?: boolean;
  } = {},
): Promise<TaskBoard> {
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId: string | undefined = farms?.[0]?.id;
  if (!farmId) return { todo: [], upcoming: [], done: [] };

  const now = new Date(`${today}T12:00:00Z`);
  const [todo, upcoming, done] = await Promise.all([
    listTodayTasks(admin, farmId, now),
    listUpcomingTasks(admin, farmId, now, opts.upcomingDays ?? 14),
    listCompletedTasks(admin, farmId, now, opts.doneDays ?? 7),
  ]);

  const all = [...todo, ...upcoming, ...done];
  const groupIds = Array.from(new Set(all.map((t) => t.stage_group_id).filter((v): v is string => !!v)));
  const [lowestOpen, chainLength] = await Promise.all([
    opts.currentStageOnly ? lowestOpenStages(admin, groupIds) : Promise.resolve(new Map<string, number>()),
    stageCounts(admin, groupIds),
  ]);
  const ids = (pick: (t: FarmTask) => string | null) =>
    Array.from(new Set(all.map(pick).filter((v): v is string => !!v)));
  const itemIds = ids((t) => t.item_id);
  const cropIds = ids((t) => t.microgreen_crop_id);
  const personIds = ids((t) => t.completed_by);

  const taskPeople = await listTaskPeople(admin);
  const ownerId = ownerOf(taskPeople)?.id ?? null;
  const assigneeName = new Map<string, string>(
    taskPeople.map((p) => [p.id, shortPersonName(p.name) ?? p.name]),
  );

  const none = Promise.resolve({ data: [] as any[] });
  const [{ data: items }, { data: crops }, { data: people }] = await Promise.all([
    itemIds.length ? admin.from("items").select("id, name").in("id", itemIds) : none,
    cropIds.length ? admin.from("microgreen_crops").select("id, name").in("id", cropIds) : none,
    personIds.length ? admin.from("profiles").select("id, full_name").in("id", personIds) : none,
  ]);
  const itemName = new Map<string, string>((items ?? []).map((r: any) => [r.id, r.name]));
  const cropName = new Map<string, string>((crops ?? []).map((r: any) => [r.id, r.name]));
  const personName = new Map<string, string>(
    (people ?? []).filter((r: any) => r.full_name).map((r: any) => [r.id, r.full_name]),
  );

  const toBoard = (t: FarmTask): BoardTask => {
    // A deactivated / removed person no longer resolves — drop them; if
    // nobody is left the task reads as anyone's.
    const ids = effectiveAssigneeIds(t, ownerId).filter((id) => assigneeName.has(id));
    return toBoardRow(t, ids);
  };
  const toBoardRow = (t: FarmTask, ids: string[]): BoardTask => ({
    id: t.id,
    title: t.title,
    title_es: t.title_es,
    description: t.description,
    description_es: t.description_es,
    type: t.type,
    due_date: t.due_date,
    due_time: t.due_time,
    priority: t.priority,
    photo_urls: t.photo_urls ?? [],
    completed_at: t.completed_at,
    completed_by_name: t.completed_by ? personName.get(t.completed_by) ?? null : null,
    stage_index: t.stage_group_id ? t.stage_index : null,
    stage_count: t.stage_group_id ? chainLength.get(t.stage_group_id) ?? null : null,
    is_microgreen: isMicrogreenTask(t),
    assignee_ids: ids,
    assignee_names: ids.map((id) => assigneeName.get(id) as string),
    subject:
      (t.microgreen_crop_id && cropName.get(t.microgreen_crop_id)) ||
      (t.item_id && itemName.get(t.item_id)) ||
      null,
  });

  // `farmHandsOnly` (the receiver, who translates for the crew): just the
  // work farm hands do — tasks with a farm hand on them or left for anyone.
  // Tasks only the farm owner holds, and all microgreen work, are left out.
  const forFarmHands = (t: FarmTask) => {
    if (isMicrogreenTask(t)) return false;
    const ids = effectiveAssigneeIds(t, ownerId);
    return ids.length === 0 || ids.some((id) => id !== ownerId);
  };
  const visible = (list: FarmTask[], open: boolean) =>
    (open && opts.currentStageOnly ? currentStagesOnly(list, lowestOpen) : list)
      .filter((t) => (opts.farmHandsOnly ? forFarmHands(t) : !opts.hideMicrogreens || !isMicrogreenTask(t)))
      .map(toBoard);
  return { todo: visible(todo, true), upcoming: visible(upcoming, true), done: visible(done, false) };
}
