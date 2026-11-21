import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { TaskBoardView } from "@/components/shared/TaskBoardView";
import { loadTaskBoard } from "@/lib/tasks/board";
import { todayPacific } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * /farm-tasks — the Head Farm Hand's only page: the farm task board, read
 * only. Same board the receiver sees (what the farm hands are working on,
 * one step at a time, English + Spanish), with nothing else around it.
 */
export default async function FarmTasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, is_active, full_name, must_change_password")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  if (profile.must_change_password) redirect("/set-password");
  if (profile.role !== "admin" && !(profile.role === "head_farmhand" && profile.is_active !== false)) {
    redirect("/");
  }

  const admin = createAdminClient();
  const today = todayPacific();
  const board = await loadTaskBoard(admin, today, {
    upcomingDays: 14,
    doneDays: 7,
    farmHandsOnly: true,
    currentStageOnly: true,
  });

  return (
    <main id="main" className="min-h-screen pb-24 bg-farm-cream">
      <PwaInstallPrompt />
      <header className="page-header">
        <h1 className="page-title">Farm Tasks</h1>
        <p className="text-xs text-white/60">{profile.full_name ?? "Head Farm Hand"}</p>
      </header>
      <EditorialHero
        eyebrow="Head Farm Hand"
        title="Farm Tasks"
        subtitle={`${board.todo.length} to do now · ${board.upcoming.length} coming up · ${board.done.length} finished this week`}
        flower="green-leaf"
      />
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-8">
        <TaskBoardView board={board} today={today} bilingual whoHasWhat />
        <div>
          <p className="section-eyebrow text-farm-muted mb-2">Account</p>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
