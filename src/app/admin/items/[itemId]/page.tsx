import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ItemForm } from "./ItemForm";

export default async function AdminItemEditPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const isNew = itemId === "new";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let item = null;
  if (!isNew) {
    const admin = createAdminClient();
    const { data } = await (admin as any)
      .from("items")
      .select("id, name, category, unit_type, default_price, chef_notes, internal_notes, source, is_archived")
      .eq("id", itemId)
      .single();
    if (!data) redirect("/admin/items");
    item = data;
  }

  return (
    <main className="pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/items"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            {isNew ? "Add Item" : item?.name}
          </h1>
        </div>
      </header>

      <div className="px-4 py-6">
        <ItemForm item={item ?? undefined} />
      </div>
    </main>
  );
}
