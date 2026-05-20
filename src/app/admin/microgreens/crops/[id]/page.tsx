import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { CropForm } from "@/components/admin/microgreens/CropForm";

export default async function EditCropPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: crop } = await (admin as any)
    .from("microgreen_crops").select("*").eq("id", params.id).maybeSingle();
  if (!crop) notFound();

  const { data: items } = await (admin as any)
    .from("items").select("id, name").order("name");

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens / Crops"
        title={crop.name}
        subtitle={crop.variety ?? undefined}
        backHref="/admin/microgreens/crops"
      />
      <div className="px-4 max-w-xl mx-auto">
        <CropForm initial={crop} items={items ?? []} />
      </div>
    </main>
  );
}
