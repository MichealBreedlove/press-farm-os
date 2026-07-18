import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aggregateHarvest, type HarvestOrder } from "@/lib/harvest";
import { HarvestClient, type HarvestExtra } from "./HarvestClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/**
 * /harvest — Harvester portal.
 *
 * The single screen a harvester account sees: the combined cross-restaurant
 * pick list for a delivery date (same roll-up as the top of
 * /admin/orders/[date], via src/lib/harvest.ts) plus the ability to add
 * extra items to a delivery. Bilingual English/Spanish — the language toggle
 * lives in the client component and persists per device.
 *
 * Deliberately excludes prices, chef notes, order status, and every other
 * admin surface — harvest crew see what to pick and can log what else they
 * picked, nothing more.
 */
export default async function HarvestPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role, is_active, full_name").eq("id", user.id).single();
  if (!profile) redirect("/login");
  // Harvesters (active) live here; admins can peek. Everyone else goes home.
  if (profile.role !== "admin" && !(profile.role === "harvester" && profile.is_active)) {
    redirect("/");
  }

  const { date: dateParam } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  const admin = createAdminClient();

  // Nearby delivery dates for the picker — a couple back (finish yesterday's
  // pick) plus the upcoming week.
  const { data: nearbyDates } = await (admin as any)
    .from("delivery_dates")
    .select("date")
    .gte("date", new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10))
    .lte("date", new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10))
    .order("date", { ascending: true });

  const dates: string[] = (nearbyDates ?? []).map((d: any) => d.date);
  const defaultDate = dates.find((d) => d >= today) ?? dates[dates.length - 1] ?? today;
  const selected = (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) ? dateParam : defaultDate;
  if (!dates.includes(selected)) dates.push(selected);
  dates.sort();

  // Orders for the selected date — just the fields the harvest roll-up needs
  // (no prices, no chef notes). Admin client: cross-restaurant by design.
  const [{ data: ordersRaw }, { data: deliveriesRaw }, { data: catalogRaw }] = await Promise.all([
    (admin as any)
      .from("orders")
      .select(`
        id, status,
        restaurant:restaurants(id, name),
        order_items(
          quantity_requested, quantity_fulfilled, is_shorted, unit_type, color_key, variety_key, picked_at,
          availability_item:availability_items(
            item:items(id, name, category, unit_type)
          )
        )
      `)
      .eq("delivery_date", selected),
    // Bonus lines already logged for the date — the harvester's own "extras"
    // ledger, shown so they can see (and undo) what they've added.
    (admin as any)
      .from("deliveries")
      .select(`
        restaurant_id,
        delivery_items ( id, quantity, unit, is_bonus, items ( id, name ) )
      `)
      .eq("delivery_date", selected),
    // Catalog for the add-extra picker — names + units only, NO prices
    // (the extras API resolves pricing server-side).
    (admin as any)
      .from("items")
      .select("id, name, unit_type")
      .eq("is_archived", false)
      .order("name"),
  ]);

  const orders: any[] = ordersRaw ?? [];
  const agg = aggregateHarvest(orders as HarvestOrder[]);

  // restaurantId → orderId so the client can hit /api/orders/[orderId]/extras.
  const orderIdByRestaurant: Record<string, string> = {};
  for (const o of orders) {
    if (o.restaurant?.id && !orderIdByRestaurant[o.restaurant.id]) {
      orderIdByRestaurant[o.restaurant.id] = o.id;
    }
  }

  const extrasByRestaurant: Record<string, HarvestExtra[]> = {};
  for (const d of (deliveriesRaw ?? []) as any[]) {
    const lines = (d.delivery_items ?? [])
      .filter((di: any) => di.is_bonus && di.items)
      .map((di: any) => ({
        id: di.id,
        itemName: di.items.name,
        quantity: Number(di.quantity ?? 0),
        unit: String(di.unit ?? "").toUpperCase(),
      }));
    if (lines.length > 0) {
      extrasByRestaurant[d.restaurant_id] = [
        ...(extrasByRestaurant[d.restaurant_id] ?? []),
        ...lines,
      ];
    }
  }

  return (
    <HarvestClient
      date={selected}
      dates={dates}
      restaurants={agg.restaurantsInPlay.map((r) => ({
        ...r,
        orderId: orderIdByRestaurant[r.id] ?? null,
      }))}
      categories={agg.categories}
      containers={agg.containers}
      itemCount={agg.itemCount}
      extrasByRestaurant={extrasByRestaurant}
      catalog={(catalogRaw ?? []) as { id: string; name: string; unit_type: string }[]}
    />
  );
}
