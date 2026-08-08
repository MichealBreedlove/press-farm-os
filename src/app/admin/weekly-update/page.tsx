import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { WeeklyUpdateClient } from "./WeeklyUpdateClient";
import {
  buildWeeklyUpdateData,
  parseWeeklyUpdateDraft,
  upcomingMondayISO,
} from "@/lib/weekly-update";

export const dynamic = "force-dynamic";

export default async function WeeklyUpdatePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from("farm_settings")
    .select("key, value")
    .in("key", ["weekly_update_general_note", "weekly_update_recipients", "weekly_update_draft"]);
  const settingsMap: Record<string, string> = {};
  for (const row of settings ?? []) settingsMap[row.key] = row.value ?? "";

  // Live-built draft + any saved edits for this week. The client starts from
  // the saved draft when one exists (so edits survive reloads), and can reset
  // back to the live build at any time.
  const weekAnchor = upcomingMondayISO();
  const liveData = await buildWeeklyUpdateData(admin);
  const savedDraft = parseWeeklyUpdateDraft(settingsMap.weekly_update_draft);
  const draftData = savedDraft && savedDraft.weekOf === weekAnchor ? savedDraft.data : null;

  const { data: farms } = await admin.from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id ?? "";

  // Active chef accounts, offered as a recipient picker (never auto-included).
  const { data: chefProfiles } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "chef")
    .eq("is_active", true);
  const chefs: { name: string; email: string }[] = [];
  const seen = new Set<string>();
  for (const chef of chefProfiles ?? []) {
    const { data: authUser } = await admin.auth.admin.getUserById(chef.id);
    const email = authUser?.user?.email?.toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    chefs.push({ name: chef.full_name ?? email, email });
  }
  chefs.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <a href="/admin/dashboard" className="text-white/70 hover:text-white min-h-0 min-w-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="page-title">Weekly Update</h1>
        </div>
      </header>
      <EditorialHero
        eyebrow="Communications"
        title="Weekly Update"
        subtitle="The Monday-morning farm update — pick who gets it and what it says"
        flower="calendula"
        backHref="/admin/dashboard"
      />
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <WeeklyUpdateClient
          settings={settingsMap}
          farmId={farmId}
          chefs={chefs}
          liveData={liveData}
          draftData={draftData}
          weekAnchor={weekAnchor}
        />
      </div>
    </main>
  );
}
