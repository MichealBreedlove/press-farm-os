import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DeliveryLogForm from "./DeliveryLogForm";
import { EditorialHero } from "@/components/shared/EditorialHero";

export default async function AdminDeliveryLogPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/admin/deliveries");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Load restaurants
  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name")
    .order("name");

  // Load all items for the form — including archived ones, so existing
  // delivery rows that reference archived items can still resolve their
  // names. The DeliveryLogForm filters archived items out of the picker
  // so admins don't see them when adding new lines.
  const { data: items } = await (admin as any)
    .from("items")
    .select("id, name, category, unit_type, default_price, is_archived")
    .order("category")
    .order("name");

  // Load existing deliveries for this date (already logged)
  const { data: existingDeliveries } = await (admin as any)
    .from("deliveries")
    .select(`
      id, restaurant_id, status, notes, total_value,
      delivery_items (
        id, item_id, quantity, unit, unit_price, line_total, is_bonus, bonus_note
      )
    `)
    .eq("delivery_date", date);

  // Load fulfilled orders for this date (pre-populate source)
  // order_items references availability_items which references items, so we need to join through
  const { data: rawOrders } = await (admin as any)
    .from("orders")
    .select(`
      id, restaurant_id, status,
      order_items (
        quantity_requested, quantity_fulfilled, unit_price_at_order,
        availability_items (
          item:items (id, name, unit_type, default_price)
        )
      )
    `)
    .eq("delivery_date", date)
    .in("status", ["fulfilled", "in_progress", "submitted"]);

  // Flatten the structure for the form: order_items[].item_id, quantity_ordered, quantity_fulfilled, unit, unit_price
  const orders = (rawOrders ?? []).map((o: any) => ({
    id: o.id,
    restaurant_id: o.restaurant_id,
    status: o.status,
    order_items: (o.order_items ?? []).map((oi: any) => {
      const item = oi.availability_items?.item;
      // unit_type may be comma-separated ("sm,lg") for multi-unit items.
      // delivery_items.unit has a CHECK constraint on a single code, so
      // we pick the first declared unit. Once order lines persist the
      // chosen unit, this should read from oi.unit instead.
      const firstUnit = String(item?.unit_type ?? "")
        .split(",").map((u: string) => u.trim()).filter(Boolean)[0] ?? "ea";
      return {
        item_id: item?.id,
        quantity_ordered: oi.quantity_requested,
        quantity_fulfilled: oi.quantity_fulfilled,
        unit: firstUnit,
        unit_price: oi.unit_price_at_order ?? item?.default_price ?? 0,
      };
    }).filter((oi: any) => oi.item_id),
  }));

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <a href="/admin/deliveries" className="text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 className="page-title">Log Delivery</h1>
            <p className="text-xs text-white/60">
              {dateLabel}
            </p>
          </div>
        </div>
      </header>
      <EditorialHero
        eyebrow={dateLabel}
        title="Log Delivery"
        subtitle="Record actual quantities + bonus items per restaurant"
        flower="marigold"
        backHref="/admin/deliveries"
      />

      <DeliveryLogForm
        date={date}
        restaurants={restaurants ?? []}
        items={items ?? []}
        existingDeliveries={existingDeliveries ?? []}
        orders={orders ?? []}
      />
    </main>
  );
}
