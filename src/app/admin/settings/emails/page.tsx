import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { EmailSettingsClient } from "./EmailSettingsClient";

export default async function EmailSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: settings } = await (admin as any).from("farm_settings").select("key, value");
  const settingsMap: Record<string, string> = {};
  for (const row of settings ?? []) settingsMap[row.key] = row.value ?? "";

  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id ?? "";

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
      <div className="px-4 py-6">
        <EmailSettingsClient settings={settingsMap} farmId={farmId} />
      </div>
    </main>
  );
}
