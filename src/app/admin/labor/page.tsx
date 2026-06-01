import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { LaborClient } from "./LaborClient";
import { EditorialHero } from "@/components/shared/EditorialHero";

export default async function AdminLaborPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: entries } = await admin
    .from("labor_entries")
    .select("*")
    .order("date", { ascending: false })
    .limit(1000);

  const { data: farms } = await admin.from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id ?? "";

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Labor Tracker</h1>
        <p className="text-sm text-white/60">Track hours for your team</p>
      </header>
      <EditorialHero
        eyebrow="Farm Management"
        title="Labor Hours"
        subtitle="Track worker hours, send weekly timesheets"
        flower="lavender"
        backHref="/admin/dashboard"
      />
      <div className="px-4 py-6">
        <LaborClient entries={entries ?? []} farmId={farmId} />
      </div>
    </main>
  );
}
