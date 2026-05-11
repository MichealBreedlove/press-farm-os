import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EventsClient } from "./EventsClient";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/constants";
import type { ItemCategory } from "@/types";

/**
 * /events — Chef advance-order portal.
 *
 * Chefs file item requests ahead of events that fall outside the normal
 * Thu/Sat/Mon ordering window. Admin reviews on /admin/event-requests
 * and accepting auto-creates the order line.
 */
export default async function EventsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: restaurantUser } = await (supabase as any)
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name)")
    .eq("user_id", user.id)
    .single();

  if (!restaurantUser?.restaurants) {
    return (
      <main className="min-h-screen bg-farm-cream flex items-center justify-center px-4 pb-24">
        <p className="text-sm text-farm-muted text-center">
          No restaurant found for your account. Please contact Press Farm.
        </p>
      </main>
    );
  }

  const restaurant = restaurantUser.restaurants;
  const admin = createAdminClient();

  // Active catalog grouped by category for the picker
  const { data: itemRows } = await (admin as any)
    .from("items")
    .select("id, name, category, unit_type, default_price, unit_prices")
    .eq("is_archived", false)
    .order("name");

  const items = (itemRows ?? []) as Array<{
    id: string;
    name: string;
    category: ItemCategory;
    unit_type: string;
    default_price: number | null;
    unit_prices: Record<string, number> | null;
  }>;

  const itemsByCategory: Record<string, typeof items> = {};
  for (const cat of CATEGORY_ORDER) itemsByCategory[cat] = [];
  for (const it of items) {
    if (itemsByCategory[it.category]) itemsByCategory[it.category].push(it);
  }

  // Chef's own request history (scoped to their restaurant)
  const { data: historyRaw } = await (admin as any)
    .from("event_requests")
    .select(
      "id, item_id, quantity, unit, needed_by_date, event_name, notes, status, admin_response, responded_at, created_at, item:items(id, name)",
    )
    .eq("restaurant_id", restaurant.id)
    .order("needed_by_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const history = (historyRaw ?? []).map((r: any) => ({
    id: r.id,
    item_name: r.item?.name ?? "(item)",
    quantity: Number(r.quantity),
    unit: r.unit,
    needed_by_date: r.needed_by_date,
    event_name: r.event_name,
    notes: r.notes,
    status: r.status,
    admin_response: r.admin_response,
    responded_at: r.responded_at,
    created_at: r.created_at,
  }));

  const categories = CATEGORY_ORDER.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

  return (
    <main className="pb-24 bg-farm-cream min-h-screen">
      <EditorialHero
        eyebrow="Advance Orders"
        title="Events"
        subtitle="Request items for upcoming events ahead of the regular delivery schedule."
        flower="marigold"
      />
      <div className="px-4 py-6 max-w-2xl mx-auto">
        <EventsClient
          restaurantName={restaurant.name}
          categories={categories}
          itemsByCategory={itemsByCategory}
          history={history}
        />
      </div>
    </main>
  );
}
