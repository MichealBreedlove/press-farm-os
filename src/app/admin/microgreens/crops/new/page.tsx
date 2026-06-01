import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { CropForm } from "@/components/admin/microgreens/CropForm";

export default async function NewCropPage() {
  const admin = createAdminClient();
  const { data: items } = await admin
    .from("items").select("id, name").order("name");

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens / Crops"
        title="New Crop"
        backHref="/admin/microgreens/crops"
      />
      <div className="px-4 max-w-xl mx-auto">
        <CropForm items={items ?? []} />
      </div>
    </main>
  );
}
