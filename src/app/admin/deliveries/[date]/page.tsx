import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import DeliveryLogForm from "./DeliveryLogForm";

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

  // Load all items for the form
  const { data: items } = await (admin as any)
    .from("items")
    .select("id, name, category, default_unit, default_price")
    .eq("is_active", true)
    .order("category")
    .order("name");

  // Load existing deliveries for this date (already logged)
  const { data: existingDeliveries } = await (admin as any)
    .from("deliveries")
    .select(`
      id, restaurant_id, status, notes, total_value,
      delivery_items (
        id, item_id, quantity, unit, unit_price, line_total
      )
    `)
    .eq("delivery_date", date);

  // Load fulfilled orders for this date (pre-populate source)
  const { data: orders } = await (admin as any)
    .from("orders")
    .select(`
      id, restaurant_id, status,
      order_items (
        item_id, quantity_ordered, quantity_fulfilled, unit, unit_price
      )
    `)
    .eq("delivery_date", date)
    .in("status", ["fulfilled", "in_progress", "submitted"]);

  return (
    <main className="pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <a href="/admin/deliveries" className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 className="text-lg font-semibold">Log Delivery</h1>
            <p className="text-xs text-gray-400">
              {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </header>

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
