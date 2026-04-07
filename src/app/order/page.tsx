import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDeliveryDate } from "@/lib/utils";
import { OrderForm } from "@/components/order/OrderForm";
import type { AvailabilityItemWithItem } from "@/types";

/**
 * /order — Chef main ordering interface (Server Component)
 *
 * Fetches the next open delivery date, availability items, and renders
 * the interactive OrderForm client component.
 */
export default async function OrderPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get chef's restaurant
  const { data: restaurantUser } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name)")
    .eq("user_id", user.id)
    .single() as any;

  if (!restaurantUser?.restaurants) {
    return (
      <main className="min-h-screen bg-farm-cream flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            No restaurant found for your account. Please contact Micheal.
          </p>
        </div>
      </main>
    );
  }

  const restaurant = restaurantUser.restaurants;
  const today = new Date().toISOString().split("T")[0];

  // Find next open delivery date
  const { data: deliveryDate } = await supabase
    .from("delivery_dates")
    .select("id, date, day_of_week, ordering_open")
    .gte("date", today)
    .eq("ordering_open", true)
    .order("date", { ascending: true })
    .limit(1)
    .single() as any;

  if (!deliveryDate) {
    return (
      <main className="min-h-screen bg-farm-cream">
        <header className="page-header">
          <h1 className="page-title">Order</h1>
          <p className="text-sm text-gray-500">{restaurant.name}</p>
        </header>
        <div className="flex items-center justify-center h-64 px-4">
          <p className="text-center text-gray-500 text-sm">
            No upcoming delivery dates open for ordering.
            <br />
            Check back soon or contact Micheal.
          </p>
        </div>
      </main>
    );
  }

  // Fetch availability items for this date + restaurant (exclude unavailable)
  const { data: rawItems } = await supabase
    .from("availability_items")
    .select(`
      id,
      item_id,
      restaurant_id,
      delivery_date,
      status,
      limited_qty,
      cycle_notes,
      created_at,
      updated_at,
      item:items(
        id,
        farm_id,
        name,
        category,
        unit_type,
        default_price,
        chef_notes,
        internal_notes,
        source,
        is_archived,
        sort_order,
        created_at,
        updated_at
      )
    `)
    .eq("delivery_date", deliveryDate.date)
    .eq("restaurant_id", restaurant.id)
    .neq("status", "unavailable")
    .order("item(sort_order)", { ascending: true }) as any;

  const availabilityItems: AvailabilityItemWithItem[] = (rawItems ?? []).filter(
    (ai: any) => ai.item && !ai.item.is_archived
  );

  const deliveryDateFormatted = formatDeliveryDate(deliveryDate.date);

  return (
    <main className="min-h-screen bg-farm-cream">
      <header className="page-header">
        <h1 className="page-title">Order for {deliveryDateFormatted}</h1>
        <p className="text-sm text-gray-500">{restaurant.name}</p>
      </header>

      <OrderForm
        availabilityItems={availabilityItems}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        deliveryDate={deliveryDate.date}
        deliveryDateFormatted={deliveryDateFormatted}
      />
    </main>
  );
}
