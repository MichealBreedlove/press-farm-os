import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDeliveryDate } from "@/lib/utils";
import { OrderForm } from "@/components/order/OrderForm";
import { DeliveryWeatherBanner } from "@/components/shared/DeliveryWeatherBanner";
import { PickCustomDateLink } from "@/components/order/PickCustomDateLink";
import { fetchAvailabilityWithRollover, materializeRollover } from "@/lib/availability";
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
  searchParams: Promise<{ edit?: string; date?: string }>;
}) {
  const { edit: editOrderId, date: dateOverride } = await searchParams;
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
            No restaurant found for your account. Please contact Press Farm.
          </p>
        </div>
      </main>
    );
  }

  const restaurant = restaurantUser.restaurants;
  const today = new Date().toISOString().split("T")[0];

  // If editing, fetch the existing order to get its delivery date and quantities.
  // We also pull unit_type/size_label/color_key so the hydrated quantity keys
  // match what OrderForm.enumerateKeys() will produce — without those, a chef
  // who ordered "5 sm + 3 lg" would see all 8 fall onto a single bare-id key
  // and the multi-unit/size selection state would silently reset.
  let initialQuantities: Record<string, number> = {};
  let initialColors: Record<string, string[]> = {};
  let initialNotes = "";
  let targetDate: string | null = null;

  if (editOrderId) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select(`
        id, delivery_date, freeform_notes, status,
        order_items(
          quantity_requested, unit_type, size_label, color_key,
          availability_items(id, item:items(unit_type))
        )
      `)
      .eq("id", editOrderId)
      .single() as any;

    if (existingOrder && ["submitted", "draft"].includes(existingOrder.status)) {
      targetDate = existingOrder.delivery_date;
      initialNotes = existingOrder.freeform_notes ?? "";
      for (const oi of existingOrder.order_items ?? []) {
        const ai = oi.availability_items;
        const aiId = ai?.id;
        if (!aiId) continue;
        const itemUnits = String(ai.item?.unit_type ?? "")
          .split(",").map((u: string) => u.trim()).filter(Boolean);
        const hasMultiUnits = itemUnits.length > 1;
        const persistedUnit: string | null = oi.unit_type ?? null;
        const persistedSize: string | null = oi.size_label ?? null;

        // Mirror the key shapes OrderForm.enumerateKeys() yields so the
        // hydrated quantities land on the same keys the form computes.
        let key: string;
        if (hasMultiUnits && persistedSize && persistedUnit) {
          key = `${aiId}__unit:${persistedUnit}__${persistedSize}`;
        } else if (hasMultiUnits && persistedUnit) {
          key = `${aiId}__unit:${persistedUnit}`;
        } else if (persistedSize) {
          key = `${aiId}__${persistedSize}`;
        } else {
          key = aiId;
        }

        initialQuantities[key] = (initialQuantities[key] ?? 0) + Number(oi.quantity_requested ?? 0);
        if (oi.color_key) {
          initialColors[key] = String(oi.color_key).split(",").filter(Boolean);
        }
      }
    }
  }

  // Find the delivery date to show: explicit ?date= override (off-schedule
  // ordering) → the edited order's date → next open date.
  let deliveryDate: any = null;

  if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) {
    const { data: explicit } = await supabase
      .from("delivery_dates")
      .select("id, date, day_of_week, ordering_open")
      .eq("date", dateOverride)
      .eq("ordering_open", true)
      .single() as any;
    deliveryDate = explicit;
  }

  if (!deliveryDate && targetDate) {
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
    initialColors = {};
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
          <p className="text-base sm:text-sm font-semibold sm:font-medium text-white/90">{restaurant.name}</p>
        </header>
        <div className="flex items-center justify-center h-64 px-4">
          <p className="text-center text-gray-500 text-sm">
            No upcoming delivery dates open for ordering.
            <br />
            Check back soon or contact Press Farm.
          </p>
        </div>
      </main>
    );
  }

  // Fetch availability items for this date + restaurant (auto-rollover to prior date if empty).
  // Events items are now tagged on the item itself (item.is_event_item) and live in the same
  // per-restaurant availability table — no separate Events-restaurant fetch / merge.
  let { data: rawItems, isInherited } = await fetchAvailabilityWithRollover(supabase, {
    deliveryDate: deliveryDate.date,
    restaurantId: restaurant.id,
    withItem: true,
    hideUnavailable: true,
  });

  // Materialize rolled-over rows into real DB rows for THIS date so the
  // submit endpoint's per-line validation (which queries by exact
  // delivery_date) accepts them. Otherwise the chef sees the items in
  // the form but Submit fails with "One or more items are not available
  // for this restaurant/date" — the IDs were for the prior date.
  if (isInherited && (rawItems ?? []).length > 0) {
    const adminForMaterialize = createAdminClient();
    await materializeRollover(adminForMaterialize, rawItems!, deliveryDate.date);
    // Re-fetch — should now hit the direct path with target-date IDs.
    const refetched = await fetchAvailabilityWithRollover(supabase, {
      deliveryDate: deliveryDate.date,
      restaurantId: restaurant.id,
      withItem: true,
      hideUnavailable: true,
    });
    rawItems = refetched.data;
  }

  const availabilityItems: AvailabilityItemWithItem[] = (rawItems ?? []).filter(
    (ai: any) => ai.item && !ai.item.is_archived,
  );

  const deliveryDateFormatted = formatDeliveryDate(deliveryDate.date);
  const isEditing = editOrderId && targetDate === deliveryDate.date;

  return (
    <main className="min-h-screen bg-farm-cream">
      <header className="page-header">
        <h1 className="page-title">{isEditing ? "Edit Order" : "Order"} for {deliveryDateFormatted}</h1>
        <p className="text-base sm:text-sm font-semibold sm:font-medium text-white/90">{restaurant.name}</p>
      </header>

      {/* Off-schedule order affordance — sits just below the header so
          it's visible without crowding. Only shown when not editing. */}
      {!isEditing && (
        <PickCustomDateLink currentDate={deliveryDate.date} />
      )}

      <div className="px-4 pt-4">
        <DeliveryWeatherBanner
          deliveryDate={deliveryDate.date}
          deliveryDateFormatted={deliveryDateFormatted}
        />
      </div>

      <OrderForm
        availabilityItems={availabilityItems}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        deliveryDate={deliveryDate.date}
        deliveryDateFormatted={deliveryDateFormatted}
        initialQuantities={isEditing ? initialQuantities : undefined}
        initialColors={isEditing ? initialColors : undefined}
        initialNotes={isEditing ? initialNotes : undefined}
        editingOrderId={isEditing ? editOrderId : undefined}
      />
    </main>
  );
}
