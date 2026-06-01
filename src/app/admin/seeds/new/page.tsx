import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SEEDS_ENABLED } from "@/lib/constants";
import { SeedForm } from "@/components/admin/seeds/SeedForm";

export const dynamic = "force-dynamic";

export default async function NewSeedPage() {
  if (!SEEDS_ENABLED) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: itemsRaw } = await admin
    .from("items")
    .select("id, name, category")
    .eq("is_archived", false)
    .order("category")
    .order("name");

  const items = (itemsRaw ?? []) as { id: string; name: string; category: string }[];

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Add seed</h1>
      </header>
      <EditorialHero
        eyebrow="Inventory"
        title="New Seed Variety"
        subtitle="Log a new packet, bulk bag, or restock"
        flower="borage"
        backHref="/admin/seeds"
      />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <SeedForm mode="create" items={items} />
      </div>
    </main>
  );
}
