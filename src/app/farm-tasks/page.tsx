import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { PwaInstallPrompt } from "@/components/shared/PwaInstallPrompt";
import { TaskBoardView } from "@/components/shared/TaskBoardView";
import { loadTaskBoard } from "@/lib/tasks/board";
import { todayPacific } from "@/lib/utils";
import { isForPerson } from "@/lib/tasks/assign";

export const dynamic = "force-dynamic";

/**
 * /farm-tasks — the Head Farm Hand's only page: the farm task board. Same
 * board the receiver sees (what the farm hands are working on, one step at
 * a time, English + Spanish), with nothing else around it — plus Finished /
 * Undo buttons, since the Head Farm Hand may close tasks (not microgreens).
 */
export default async function FarmTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const mineOnly = show === "mine";
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
  const full = await loadTaskBoard(admin, today, {
    upcomingDays: 14,
    doneDays: 7,
    farmHandsOnly: true,
    currentStageOnly: true,
  });
  // "My tasks" = the ones with this person on them, plus anyone's (same
  // rule as the Farm Hand portal). Finished list: only what they are on.
  const board = mineOnly
    ? {
        todo: full.todo.filter((t) => isForPerson(t.assignee_ids, user.id)),
        upcoming: full.upcoming.filter((t) => isForPerson(t.assignee_ids, user.id)),
        done: full.done.filter((t) => isForPerson(t.assignee_ids, user.id)),
      }
    : full;
  const myCount = full.todo.filter((t) => isForPerson(t.assignee_ids, user.id)).length;

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
        <nav aria-label="Whose tasks" className="grid grid-cols-2 gap-2">
          {[
            { href: "/farm-tasks", label: "Everyone's", active: !mineOnly, count: full.todo.length },
            { href: "/farm-tasks?show=mine", label: "My tasks", active: mineOnly, count: myCount },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`min-h-[48px] rounded-xl border text-base font-semibold flex items-center justify-center gap-2 transition-colors ${
                tab.active
                  ? "bg-farm-green text-white border-farm-green shadow-sm"
                  : "bg-white text-farm-dark/80 border-farm-dark/10 hover:border-farm-green/40"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`min-w-[24px] h-6 px-1.5 rounded-full text-xs font-bold tabular-nums flex items-center justify-center ${
                    tab.active ? "bg-white text-farm-green" : "bg-farm-green text-white"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <TaskBoardView board={board} today={today} bilingual whoHasWhat={!mineOnly} canComplete />
        <div>
          <p className="section-eyebrow text-farm-muted mb-2">Account</p>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
