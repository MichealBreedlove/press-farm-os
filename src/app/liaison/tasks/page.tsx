import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { TaskBoardView } from "@/components/shared/TaskBoardView";
import { loadTaskBoard } from "@/lib/tasks/board";
import { todayPacific } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** /liaison/tasks — what needs doing at the farm and what was accomplished. */
export default async function LiaisonTasksPage() {
  const admin = createAdminClient();
  const today = todayPacific();
  const board = await loadTaskBoard(admin, today, { upcomingDays: 14, doneDays: 14 });

  return (
    <main id="main" className="min-h-screen pb-28 bg-farm-cream">
      <EditorialHero
        eyebrow="Farm Liaison"
        title="Farm Tasks"
        subtitle={`${board.todo.length} to do · ${board.upcoming.length} coming up · ${board.done.length} accomplished in the last two weeks`}
        flower="green-leaf"
        backHref="/liaison"
      />
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <TaskBoardView board={board} today={today} />
      </div>
    </main>
  );
}
