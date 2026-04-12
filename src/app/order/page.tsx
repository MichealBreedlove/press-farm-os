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
export default async function OrderPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit: editOrderId } = await searchParams;
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

  // If editing, fetch the existing order to get its delivery date and quantities
  let initialQuantities: Record<string, number> = {};
  let initialNotes = "";
  let targetDate: string | null = null;

  if (editOrderId) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select(`
        id, delivery_date, freeform_notes, status,
        order_items(quantity_requested, availability_items(id))
      `)
      .eq("id", editOrderId)
      .single() as any;

    if (existingOrder && ["submitted", "draft"].includes(existingOrder.status)) {
      targetDate = existingOrder.delivery_date;
      initialNotes = existingOrder.freeform_notes ?? "";
      for (const oi of existingOrder.order_items ?? []) {
        const aiId = oi.availability_items?.id;
        if (aiId) initialQuantities[aiId] = oi.quantity_requested;
      }
    }
  }

  // Find the delivery date to show: the edited order's date (if still open) OR the next open date
  let deliveryDate: any = null;

  if (targetDate) {
    const { data: editDate } = await supabase
      .from("delivery_dates")
      .select("id, date, day_of_week, ordering_open")
      .eq("date", targetDate)
      .eq("ordering_open", true)
      .single() as any;
    deliveryDate = editDate;
  }

  if (!deliveryDate) {
    // Fall back to next open date (edit date closed or not editing)
    initialQuantities = {};
    initialNotes = "";
    const { data: nextDate } = await supabase
      .from("delivery_dates")
      .select("id, date, day_of_week, ordering_open")
      .gte("date", today)
      .eq("ordering_open", true)
      .order("date", { ascending: true })
      .limit(1)
      .single() as any;
    deliveryDate = nextDate;
  }

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
        image_url,
        season_status,
        season_note,
        size,
        color,
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
  const isEditing = editOrderId && targetDate === deliveryDate.date;

  return (
    <main className="min-h-screen bg-farm-cream">
      <header className="page-header">
        <h1 className="page-title">{isEditing ? "Edit Order" : "Order"} for {deliveryDateFormatted}</h1>
        <p className="text-sm text-gray-500">{restaurant.name}</p>
      </header>

      <OrderForm
        availabilityItems={availabilityItems}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        deliveryDate={deliveryDate.date}
        deliveryDateFormatted={deliveryDateFormatted}
        initialQuantities={isEditing ? initialQuantities : undefined}
        initialNotes={isEditing ? initialNotes : undefined}
        editingOrderId={isEditing ? editOrderId : undefined}
      />
    </main>
  );
}
