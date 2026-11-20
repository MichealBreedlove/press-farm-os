import type { createAdminClient } from "@/lib/supabase/admin";
import type { FarmTask, FarmTaskType } from "@/types/database";
import { listCompletedTasks, listTodayTasks, listUpcomingTasks } from "./queries";

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
  opts: { upcomingDays?: number; doneDays?: number } = {},
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
  const ids = (pick: (t: FarmTask) => string | null) =>
    Array.from(new Set(all.map(pick).filter((v): v is string => !!v)));
  const itemIds = ids((t) => t.item_id);
  const cropIds = ids((t) => t.microgreen_crop_id);
  const personIds = ids((t) => t.completed_by);

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

  const toBoard = (t: FarmTask): BoardTask => ({
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
    subject:
      (t.microgreen_crop_id && cropName.get(t.microgreen_crop_id)) ||
      (t.item_id && itemName.get(t.item_id)) ||
      null,
  });

  return { todo: todo.map(toBoard), upcoming: upcoming.map(toBoard), done: done.map(toBoard) };
}
