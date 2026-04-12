import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { SuggestionBoxClient } from "./SuggestionBoxClient";

export default async function SuggestionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: suggestions } = await (admin as any)
    .from("suggestions")
    .select("*")
    .order("created_at", { ascending: false });

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
          <h1 className="page-title">Suggestion Box</h1>
        </div>
      </header>
      <div className="px-4 py-6">
        <SuggestionBoxClient suggestions={suggestions ?? []} farmId={farmId} />
      </div>
    </main>
  );
}
