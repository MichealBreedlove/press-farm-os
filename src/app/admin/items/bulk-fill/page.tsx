import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { BulkFillClient } from "./BulkFillClient";

export const dynamic = "force-dynamic";

export default async function BulkFillPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Pull every active item plus the fillable-content fields so the
  // client can show what's already done and what would change. Sorting
  // by category then name matches the catalog's natural grouping so the
  // progress list reads predictably.
  const { data: itemsRaw } = await admin
    .from("items")
    .select(
      "id, name, category, chef_notes, growing_notes, season_note, days_to_maturity, sun_requirement, sow_method, sow_depth, plant_spacing",
    )
    .eq("is_archived", false)
    .order("category")
    .order("name");

  const items = (itemsRaw ?? []) as Array<{
    id: string;
    name: string;
    category: string;
    chef_notes: string | null;
    growing_notes: string | null;
    season_note: string | null;
    days_to_maturity: number | null;
    sun_requirement: string | null;
    sow_method: string | null;
    sow_depth: string | null;
    plant_spacing: string | null;
  }>;

  // Pre-classify items so the client can show the up-front breakdown
  // without having to call the API.
  const fillable = items.filter(
    (i) =>
      !i.chef_notes ||
      !i.growing_notes ||
      !i.season_note ||
      !i.days_to_maturity ||
      !i.sun_requirement ||
      !i.sow_method ||
      !i.sow_depth ||
      !i.plant_spacing,
  );
  const alreadyFilled = items.length - fillable.length;

  const fillableTargets = fillable.map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
  }));

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/items"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="page-title">Bulk Fill</h1>
        </div>
      </header>
      <EditorialHero
        eyebrow="AI Catalog"
        title="Fill All Items"
        subtitle={`${fillable.length} item${fillable.length === 1 ? "" : "s"} have empty growing-condition or notes fields. ${alreadyFilled} already filled.`}
        flower="nasturtium"
        backHref="/admin/items"
      />
      <BulkFillClient targets={fillableTargets} alreadyFilledCount={alreadyFilled} />
    </main>
  );
}
