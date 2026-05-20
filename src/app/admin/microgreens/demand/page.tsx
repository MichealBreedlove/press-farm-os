import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { DemandGrid } from "@/components/admin/microgreens/DemandGrid";

export default async function DemandPage() {
  const admin = createAdminClient();
  const [{ data: crops }, { data: restaurants }, { data: demand }] = await Promise.all([
    (admin as any).from("microgreen_crops").select("*").eq("is_active", true).order("name"),
    (admin as any).from("restaurants").select("id, name").order("name"),
    (admin as any).from("microgreen_demand").select("*"),
  ]);

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Demand Targets"
        subtitle="Set weekly oz targets per crop × restaurant × delivery day"
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-5xl mx-auto">
        <DemandGrid
          crops={crops ?? []}
          restaurants={restaurants ?? []}
          demand={demand ?? []}
        />
      </div>
    </main>
  );
}
