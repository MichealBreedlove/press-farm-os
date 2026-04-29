import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ItemsClient } from "./ItemsClient";
import { EditorialHero } from "@/components/shared/EditorialHero";

export default async function AdminItemsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: itemsRaw } = await (admin as any)
    .from("items")
    .select("id, name, category, unit_type, default_price, unit_prices, is_archived, chef_notes, image_url")
    .order("category")
    .order("name");

  const items = itemsRaw ?? [];

  const activeCount = items.filter((i: any) => !i.is_archived).length;
  const archivedCount = items.length - activeCount;

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Catalog</h1>
      </header>
      <EditorialHero
        eyebrow="Farm Management"
        title="Item Catalog"
        subtitle={`${activeCount} active item${activeCount === 1 ? "" : "s"}${archivedCount > 0 ? ` · ${archivedCount} archived` : ""}`}
        flower="nasturtium"
        backHref="/admin/dashboard"
      />

      <div className="px-4 py-4 max-w-3xl mx-auto">
        <ItemsClient items={items} addItemHref="/admin/items/new" />
      </div>
    </main>
  );
}
