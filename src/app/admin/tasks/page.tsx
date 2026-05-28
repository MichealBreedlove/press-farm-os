import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { FloralCorners } from "@/components/shared/FloralCorners";
import { TasksClient } from "@/components/admin/tasks/TasksClient";
import {
  listTodayTasks,
  listUpcomingTasks,
  listCompletedTasks,
  listPendingDrafts,
} from "@/lib/tasks/queries";
import type { FarmTask, InboxTaskDraft } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Tolerant fetches: migration 062 may not be applied yet. Each helper
  // already returns [] on error, so the page still renders.
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id;

  let today: FarmTask[] = [];
  let upcoming: FarmTask[] = [];
  let done: FarmTask[] = [];
  let drafts: InboxTaskDraft[] = [];
  if (farmId) {
    [today, upcoming, done, drafts] = await Promise.all([
      listTodayTasks(admin, farmId),
      listUpcomingTasks(admin, farmId),
      listCompletedTasks(admin, farmId),
      listPendingDrafts(admin),
    ]);
  }

  // Enrichment — fetch the names of linked items/crops so the UI can show
  // them next to the title without an N+1.
  const itemIds = new Set<string>();
  const cropIds = new Set<string>();
  const matchedItemIds = new Set<string>();
  for (const t of [...today, ...upcoming, ...done]) {
    if (t.item_id) itemIds.add(t.item_id);
    if (t.microgreen_crop_id) cropIds.add(t.microgreen_crop_id);
  }
  for (const d of drafts) {
    if (d.matched_item_id) matchedItemIds.add(d.matched_item_id);
  }
  const allItemIds = Array.from(new Set([...itemIds, ...matchedItemIds]));

  const itemMap = new Map<string, string>();
  const cropMap = new Map<string, string>();

  if (allItemIds.length > 0) {
    const { data: items } = await (admin as any)
      .from("items")
      .select("id, name")
      .in("id", allItemIds);
    for (const r of items ?? []) itemMap.set(r.id, r.name);
  }
  if (cropIds.size > 0) {
    const { data: crops } = await (admin as any)
      .from("microgreen_crops")
      .select("id, name")
      .in("id", Array.from(cropIds));
    for (const r of crops ?? []) cropMap.set(r.id, r.name);
  }

  return (
    <div className="relative min-h-screen">
      <FloralCorners />
      <EditorialHero
        eyebrow="Operations"
        title="Tasks"
        subtitle={`${today.length} due today · ${upcoming.length} upcoming${
          drafts.length > 0 ? ` · ${drafts.length} draft${drafts.length === 1 ? "" : "s"} awaiting review` : ""
        }`}
        flower="borage"
      />
      <TasksClient
        initialToday={today}
        initialUpcoming={upcoming}
        initialDone={done}
        initialDrafts={drafts}
        itemNames={Object.fromEntries(itemMap)}
        cropNames={Object.fromEntries(cropMap)}
      />
    </div>
  );
}
