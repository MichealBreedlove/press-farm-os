import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { CropPlanTimeline } from "./CropPlanTimeline";

export default async function CropPlanPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const currentYear = new Date().getFullYear();

  const { data: plantings } = await (admin as any)
    .from("plantings")
    .select("*, items(name, image_url, category, unit_type)")
    .eq("season", currentYear)
    .order("crop_name");

  const { data: items } = await (admin as any)
    .from("items")
    .select("id, name, category, unit_type, default_price, image_url")
    .eq("is_archived", false)
    .order("name");

  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id ?? "";

  // Also load legacy crop_plan_entries for the season view
  const { data: legacyEntries } = await (admin as any)
    .from("crop_plan_entries")
    .select("*")
    .order("item_name");

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Crop Plan</h1>
            <p className="text-sm text-white/60">Season {currentYear}</p>
          </div>
        </div>
      </header>
      <CropPlanTimeline
        plantings={plantings ?? []}
        items={items ?? []}
        farmId={farmId}
        season={currentYear}
        legacyEntries={legacyEntries ?? []}
      />
    </main>
  );
}
