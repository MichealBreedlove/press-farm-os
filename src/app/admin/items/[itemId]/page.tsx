import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ItemForm } from "./ItemForm";
import { SubitemsPanel } from "./SubitemsPanel";

// Defeat Next.js's static rendering cache for this page — data here changes
// constantly during admin edits and we never want a stale flag set leaking
// through after a save.
export const dynamic = "force-dynamic";

export default async function AdminItemEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ parent?: string }>;
}) {
  const { itemId } = await params;
  const { parent: parentFromQuery } = await searchParams;
  const isNew = itemId === "new";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  let item = null;
  if (!isNew) {
    const { data } = await (admin as any)
      .from("items")
      .select("id, name, category, unit_type, default_price, unit_prices, chef_notes, internal_notes, source, is_archived, is_event_item, is_press_bar_item, show_in_regular_menu, image_url, season_status, season_note, days_to_maturity, sow_depth, plant_spacing, sun_requirement, sow_method, indoor_start_weeks, growing_notes, size, variety, color, parent_item_id")
      .eq("id", itemId)
      .single();
    if (!data) redirect("/admin/items");
    item = data;
  }

  // Eligible parents: any non-archived item that isn't itself a child
  // (single-level rule), and isn't this item. Used to populate the
  // Parent dropdown in the form.
  const { data: parentCandidatesRaw } = await (admin as any)
    .from("items")
    .select("id, name, category, parent_item_id, is_archived")
    .is("parent_item_id", null)
    .eq("is_archived", false)
    .order("name");
  const parentCandidates = (parentCandidatesRaw ?? []).filter((p: any) => p.id !== itemId);

  // If editing an existing item, load its children (subitems) so we can
  // show them in the SubitemsPanel below the form. Also drives whether
  // this item can itself become a child (it can't, if it has children).
  let children: any[] = [];
  if (!isNew && item) {
    const { data: kids } = await (admin as any)
      .from("items")
      .select("id, name, category, image_url, is_archived")
      .eq("parent_item_id", item.id)
      .order("name");
    children = kids ?? [];
  }

  // Pre-fill parent for new subitems via ?parent=ID query param. Used by
  // the "Add subitem" button on the parent's detail page.
  let prefillFromParent: { parent_item_id: string; category?: string; unit_type?: string; source?: string | null; growing_notes?: string | null } | null = null;
  if (isNew && parentFromQuery) {
    const { data: prefillParent } = await (admin as any)
      .from("items")
      .select("id, category, unit_type, source, growing_notes")
      .eq("id", parentFromQuery)
      .single();
    if (prefillParent) {
      prefillFromParent = {
        parent_item_id: prefillParent.id,
        category: prefillParent.category,
        unit_type: prefillParent.unit_type,
        source: prefillParent.source,
        growing_notes: prefillParent.growing_notes,
      };
    }
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

      <div className="px-4 py-6 space-y-6">
        {/* key forces a fresh mount per item so useState initializers
            always reflect the freshly fetched row — without it, navigating
            between item edit pages keeps stale form state from the
            previous item (which is how the menu-flag mismatch slipped in). */}
        <ItemForm
          key={item?.id ?? "new"}
          item={item ?? undefined}
          parentCandidates={parentCandidates}
          hasChildren={children.length > 0}
          prefillFromParent={prefillFromParent ?? undefined}
        />

        {/* Subitems panel — only shown on existing parent items. Lets the
            admin see all children at a glance and quick-add a new one
            with parent_item_id pre-filled. */}
        {!isNew && item && !item.parent_item_id && (
          <SubitemsPanel parentId={item.id} parentName={item.name} children={children} />
        )}
      </div>
    </main>
  );
}
