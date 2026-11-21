import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { TaskBoardView } from "@/components/shared/TaskBoardView";
import { loadTaskBoard } from "@/lib/tasks/board";
import { todayPacific } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * /receiver/tasks — the FARM HANDS' task list, read-only, with each task in
 * English AND the Spanish the farm hands read: the receiver is the crew's
 * translator (Micheal isn't fluent in Spanish). Micheal's own tasks and all
 * microgreen work are left out — only what the farm hands are doing. Finishing tasks stays on the Farm
 * Hand portal and /admin/tasks.
 */
export default async function ReceiverTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && !(profile.role === "receiver" && profile.is_active !== false)) {
    redirect("/");
  }

  const admin = createAdminClient();
  const today = todayPacific();
  const board = await loadTaskBoard(admin, today, { upcomingDays: 14, doneDays: 7, farmHandsOnly: true });

  return (
    <main id="main" className="min-h-screen pb-24 bg-farm-cream">
      <EditorialHero
        eyebrow="Receiving"
        title="Farm Tasks"
        subtitle="What the farm hands are working on — English and Spanish"
        flower="green-leaf"
        backHref="/receiver"
      />
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <TaskBoardView board={board} today={today} bilingual />
      </div>
    </main>
  );
}
