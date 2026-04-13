import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ItemsClient } from "./ItemsClient";

export default async function AdminItemsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: itemsRaw } = await (admin as any)
    .from("items")
    .select("id, name, category, unit_type, default_price, is_archived, chef_notes, image_url")
    .order("category")
    .order("name");

  const items = itemsRaw ?? [];

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Item Catalog</h1>
        <p className="text-xs text-gray-400 mt-1">
          {items.filter((i: any) => !i.is_archived).length} active items
        </p>
      </header>

      <div className="px-4 py-4">
        <Link
          href="/admin/items/new"
          className="btn-primary w-full flex items-center justify-center gap-2 mb-4 text-sm font-semibold"
        >
          + Add Item
        </Link>
        <ItemsClient items={items} />
      </div>
    </main>
  );
}
