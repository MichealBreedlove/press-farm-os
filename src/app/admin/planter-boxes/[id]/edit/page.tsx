import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { BoxForm } from "@/components/admin/planter-boxes/BoxForm";

export default async function EditPlanterBoxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: box } = await (admin as any).from("planter_boxes").select("*").eq("id", id).single();
  if (!box) notFound();

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Planter Boxes"
        title="Edit Box"
        subtitle={box.name}
        flower="rosemary"
        backHref={`/admin/planter-boxes/${id}`}
      />
      <div className="px-4 max-w-3xl mx-auto">
        <BoxForm initial={box} />
      </div>
    </main>
  );
}
