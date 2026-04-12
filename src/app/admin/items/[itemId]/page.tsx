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
      .select("id, name, category, unit_type, default_price, chef_notes, internal_notes, source, is_archived, image_url, season_status, season_note, days_to_maturity, sow_depth, plant_spacing, sun_requirement, sow_method, indoor_start_weeks, growing_notes, size, variety, color")
      .eq("id", itemId)
      .single();
    if (!data) redirect("/admin/items");
    item = data;
  }

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/items"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">
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
