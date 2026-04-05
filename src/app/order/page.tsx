import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import OrderFormClient from "./client";

export default async function OrderPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get chef's restaurant
  const { data: restaurantUser } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name, slug)")
    .eq("user_id", user.id)
    .single();

  if (!restaurantUser) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-3xl mb-3">🌿</p>
          <p className="text-gray-600">Your account isn&apos;t linked to a restaurant yet.</p>
          <p className="text-sm text-gray-400 mt-1">Contact your farm admin.</p>
        </div>
      </main>
    );
  }

  const restaurant = restaurantUser.restaurants as { id: string; name: string; slug: string };

  // Get next open delivery date
  const today = new Date().toISOString().split("T")[0];
  const { data: deliveryDate } = await supabase
    .from("delivery_dates")
    .select("*")
    .eq("ordering_open", true)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .single();

  if (!deliveryDate) {
    return (
      <main className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
          <h1 className="text-lg font-semibold">Order</h1>
          <p className="text-sm text-gray-500">{restaurant.name}</p>
        </header>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <p className="text-4xl mb-4">🔒</p>
          <p className="font-semibold text-gray-700">Ordering is closed</p>
          <p className="text-sm text-gray-400 mt-1">Check back before the next delivery.</p>
        </div>
      </main>
    );
  }

  // Get availability items for this restaurant + date
  const { data: availability } = await supabase
    .from("availability_items")
    .select(`
      id,
      status,
      limited_qty,
      cycle_notes,
      item_id,
      items(id, name, category, unit_type, chef_notes, default_price)
    `)
    .eq("restaurant_id", restaurant.id)
    .eq("delivery_date", deliveryDate.date)
    .neq("status", "unavailable")
    .order("items(category)")
    .order("items(sort_order)")
    .order("items(name)");

  // Get existing order if any
  const { data: existingOrder } = await supabase
    .from("orders")
    .select(`
      id, status, freeform_notes,
      order_items(id, availability_item_id, quantity_requested)
    `)
    .eq("restaurant_id", restaurant.id)
    .eq("delivery_date", deliveryDate.date)
    .single();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold capitalize">
              {deliveryDate.day_of_week} · {formatDate(deliveryDate.date)}
            </h1>
            <p className="text-sm text-gray-500">{restaurant.name}</p>
          </div>
          <a href="/history" className="text-sm text-farm-green font-medium">History</a>
        </div>
      </header>

      <OrderFormClient
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        deliveryDate={deliveryDate.date}
        availabilityItems={availability ?? []}
        existingOrder={existingOrder ?? null}
        userId={user.id}
      />
    </main>
  );
}
