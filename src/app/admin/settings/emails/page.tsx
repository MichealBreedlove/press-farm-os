import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { EmailSettingsClient } from "./EmailSettingsClient";
import { EditorialHero } from "@/components/shared/EditorialHero";

export default async function EmailSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: settings } = await admin.from("farm_settings").select("key, value");
  const settingsMap: Record<string, string> = {};
  for (const row of settings ?? []) settingsMap[row.key] = row.value ?? "";

  const { data: farms } = await admin.from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id ?? "";

  // Active chef accounts, offered as a recipient picker for the weekly update.
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
          <a href="/admin/settings" className="text-white/70 hover:text-white min-h-0 min-w-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="page-title">Email Settings</h1>
        </div>
      </header>
      <EditorialHero
        eyebrow="Configuration"
        title="Email Settings"
        subtitle="From-addresses, sender names, templates"
        flower="allium"
        backHref="/admin/settings"
      />
      <div className="px-4 py-6">
        <EmailSettingsClient settings={settingsMap} farmId={farmId} chefs={chefs} />
      </div>
    </main>
  );
}
