import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDeliveryDate, todayPacific } from "@/lib/utils";
import { EVENT_MENU_KEY_PREFIX } from "@/lib/constants";
import { OrderForm } from "@/components/order/OrderForm";
import { DeliveryWeatherBanner } from "@/components/shared/DeliveryWeatherBanner";
import { GreenhouseReadyBanner } from "@/components/shared/GreenhouseReadyBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { PickCustomDateLink } from "@/components/order/PickCustomDateLink";
import { fetchAvailabilityWithRollover, materializeRollover } from "@/lib/availability";
import { computeReadyToHarvest, type ReadyHarvestCrop } from "@/lib/microgreens/readyToHarvest";
import { buildOrderKey } from "@/lib/order-keys";
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
    .select("restaurant_id, restaurants(id, name, slug)")
    .eq("user_id", user.id)
    .single() as any;

  // The Events team orders through their own system, not the chef form.
  if (restaurantUser?.restaurants?.slug === "events") {
    redirect("/events/order");
  }

  if (!restaurantUser?.restaurants) {
    return (
      <main className="min-h-screen bg-farm-cream flex items-center justify-center px-4">
        <EmptyState
          flower="pansy"
          title="No restaurant linked"
          body="Your account isn't linked to a restaurant yet. Please contact Press Farm."
        /></main>
    );
  }

  const restaurant = restaurantUser.restaurants;
  // Farm-local "today" — UTC rolls over at 4–5pm Pacific, right when chefs
  // order for tomorrow; the UTC date made the next-open-date fallback skip
  // a still-open same-day date in the evening window.
  const today = todayPacific();

  // If editing, fetch the existing order to get its delivery date and quantities.
  // We also pull unit_type/size_label/color_key so the hydrated quantity keys
  // match what OrderForm.enumerateKeys() will produce — without those, a chef
  // who ordered "5 sm + 3 lg" would see all 8 fall onto a single bare-id key
  // and the multi-unit/size selection state would silently reset.
  let initialQuantities: Record<string, number> = {};
  let initialColors: Record<string, string[]> = {};
  let initialEventChecked: Record<string, boolean> = {};
  let initialSplitOpen: Record<string, boolean> = {};
  let initialNotes = "";
  let targetDate: string | null = null;

  if (editOrderId) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select(`
        id, delivery_date, freeform_notes, status,
        order_items(
          quantity_requested, unit_type, size_label, color_key, menu_section,
          availability_items(id, item:items(unit_type))
        )
      `)
      .eq("id", editOrderId)
      .single() as any;

    if (existingOrder && ["submitted", "draft"].includes(existingOrder.status)) {
      targetDate = existingOrder.delivery_date;
      initialNotes = existingOrder.freeform_notes ?? "";
      // Pre-pass: an item with BOTH regular and events lines hydrates as a
      // SPLIT (events lines under prefixed event-portion keys); an item with
      // ONLY events lines hydrates as the whole-item "For an event" checkmark.
      const aiIdsWithRegular = new Set<string>();
      for (const oi of existingOrder.order_items ?? []) {
        const aiId = oi.availability_items?.id;
        if (aiId && oi.menu_section !== "events") aiIdsWithRegular.add(aiId);
      }
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
        let key = buildOrderKey(aiId, {
          unit: persistedUnit,
          size: persistedSize,
          hasMultiUnits,
        });
        if (oi.menu_section === "events") {
          if (aiIdsWithRegular.has(aiId)) {
            // Split line — the event portion lives under the prefixed keys.
            key = `${EVENT_MENU_KEY_PREFIX}${key}`;
            initialSplitOpen[aiId] = true;
          } else {
            // Whole item was for the event — hydrate as the checkmark.
            initialEventChecked[aiId] = true;
          }
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
    initialEventChecked = {};
    initialSplitOpen = {};
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
        <div className="px-4">
          <EmptyState
            flower="squash-blossom"
            title="Ordering is closed right now"
            body="No upcoming delivery dates are open for ordering. Check back soon or contact Press Farm."
          />
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

  // Microgreens ready to cut in the greenhouse right now — surfaced so chefs and
  // the bar team harvest from our trays instead of ordering from Meadowood. The
  // microgreen tables are admin-only RLS, so this reads through the service-role
  // client. Best-effort: any failure leaves the banner empty, never blocking the
  // order flow (mirrors the weather banner's silent-fail behavior).
  let readyMicrogreens: ReadyHarvestCrop[] = [];
  try {
    const adminForGreenhouse = createAdminClient();
    const [{ data: mgCrops }, { data: mgBatches }, { data: mgTrays }] = await Promise.all([
      (adminForGreenhouse as any).from("microgreen_crops").select("*").eq("is_active", true),
      (adminForGreenhouse as any).from("microgreen_batches").select("id, crop_id"),
      (adminForGreenhouse as any)
        .from("microgreen_trays")
        .select("*")
        .in("status", ["blackout", "light", "harvesting"]),
    ]);
    readyMicrogreens = computeReadyToHarvest({
      crops: mgCrops ?? [],
      batches: mgBatches ?? [],
      trays: mgTrays ?? [],
      now: new Date(),
    });
  } catch {
    readyMicrogreens = [];
  }

  return (
    <main className="min-h-screen bg-farm-cream">
      <header className="page-header">
        <h1 className="page-title">{isEditing ? "Edit Order" : "Order"} for {deliveryDateFormatted}</h1>
        <p className="text-base sm:text-sm font-semibold sm:font-medium text-white/90">{restaurant.name}</p>
      </header>

      {/* Off-schedule order affordance — sits just below the header so
          it's visible without crowding. Only shown when not editing. */}
      {!isEditing && (
        <PickCustomDateLink key={deliveryDate.date} currentDate={deliveryDate.date} />
      )}

      <div className="px-4 pt-4 space-y-4">
        <DeliveryWeatherBanner
          deliveryDate={deliveryDate.date}
          deliveryDateFormatted={deliveryDateFormatted}
        />
        <GreenhouseReadyBanner crops={readyMicrogreens} />
      </div>

      {/* Keyed by date: /order?date=X navigations reuse this page instance,
          so without the key the form carries the previous date's quantity
          state (keyed by that date's availability IDs) across the switch. */}
      <OrderForm
        key={deliveryDate.date}
        availabilityItems={availabilityItems}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
        deliveryDate={deliveryDate.date}
        deliveryDateFormatted={deliveryDateFormatted}
        initialQuantities={isEditing ? initialQuantities : undefined}
        initialColors={isEditing ? initialColors : undefined}
        initialEventChecked={isEditing ? initialEventChecked : undefined}
        initialSplitOpen={isEditing ? initialSplitOpen : undefined}
        initialNotes={isEditing ? initialNotes : undefined}
        editingOrderId={isEditing ? editOrderId : undefined}
      />
    </main>
  );
}
