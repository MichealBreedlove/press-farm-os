import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { formatDeliveryDate } from "@/lib/utils";
import { ReceiverClient } from "./ReceiverClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/**
 * /receiver — Receiver-side dashboard.
 *
 * Shows today's deliveries (or any selected date) grouped by restaurant.
 * For each ordered line item, computes its state:
 *   - READY  : ordered + delivered same qty
 *   - SHORT  : ordered + delivered less
 *   - PENDING: ordered + nothing delivered yet (delivery hasn't been logged)
 *   - EXTRA  : delivered but never ordered
 *
 * Event items (items.is_event_item = true) are flagged separately so the
 * receiver can set them aside for special-occasion use.
 */
export default async function ReceiverPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify role
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (profile.role !== "receiver" && profile.role !== "admin") {
    // Chefs land back on their order portal; admins still get to peek.
    redirect("/order");
  }

  const { date: dateParam } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const selected = (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) ? dateParam : today;

  // Use admin client for the data join — receivers have RLS read access but
  // it's simpler to assemble cross-restaurant data through the admin client.
  const admin = createAdminClient();

  // Recent + upcoming dates for the picker (last 7 days + next 7 days)
  const { data: recentDates } = await (admin as any)
    .from("delivery_dates")
    .select("date, day_of_week, ordering_open")
    .gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .lte("date", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
    .order("date", { ascending: true });

  // Restaurants (excluding the legacy Events row — events are now a tag on items)
  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name")
    .not("name", "ilike", "%event%")
    .order("name");

  const restaurantList: { id: string; name: string }[] = restaurants ?? [];

  // Orders for selected date — need the order_items joined with availability_items → items
  const { data: orders } = await (admin as any)
    .from("orders")
    .select(`
      id, restaurant_id, delivery_date, status, freeform_notes,
      order_items (
        id, quantity_requested, quantity_fulfilled, is_shorted, shortage_reason,
        availability_item_id,
        availability_items (
          id, item_id,
          items ( id, name, category, unit_type, image_url, is_event_item )
        )
      )
    `)
    .eq("delivery_date", selected);

  // Deliveries + delivery_items for the same date
  const { data: deliveries } = await (admin as any)
    .from("deliveries")
    .select(`
      id, restaurant_id, delivery_date, status, total_value,
      delivery_items (
        id, item_id, quantity, unit, unit_price, line_total,
        items ( id, name, category, unit_type, image_url, is_event_item )
      )
    `)
    .eq("delivery_date", selected);

  return (
    <main className="min-h-screen pb-24 bg-farm-cream">
      <header className="page-header">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title">Receiving</h1>
          <Link href="/api/auth/sign-out" className="text-xs text-white/60 hover:text-white">Sign out</Link>
        </div>
        <p className="text-xs text-white/60">{profile.full_name ?? "Receiver"}</p>
      </header>

      <EditorialHero
        eyebrow="Today's Receiving"
        title={formatDeliveryDate(selected)}
        subtitle="What's coming in across all restaurants"
        flower="green-leaf"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        <ReceiverClient
          selectedDate={selected}
          dates={(recentDates ?? []).map((d: any) => ({
            date: d.date,
            day: d.day_of_week,
            isToday: d.date === today,
            isPast: d.date < today,
          }))}
          restaurants={restaurantList}
          orders={orders ?? []}
          deliveries={deliveries ?? []}
        />
      </div>
    </main>
  );
}
