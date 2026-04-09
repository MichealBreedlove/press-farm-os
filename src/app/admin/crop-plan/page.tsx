import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { CropPlanClient } from "./CropPlanClient";

export default async function CropPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: entries } = await (admin as any)
    .from("crop_plan_entries")
    .select("*")
    .order("item_name");

  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id ?? "";

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Crop Plan</h1>
        <p className="text-sm text-white/60">Seasonal growing schedule</p>
      </header>
      <CropPlanClient entries={entries ?? []} farmId={farmId} />
    </main>
  );
}
