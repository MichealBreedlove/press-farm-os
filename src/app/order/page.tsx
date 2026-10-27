import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDeliveryDate, minOrderableDatePacific, closesTodayPacific, ORDER_CUTOFF_LABEL } from "@/lib/utils";
import { EVENT_MENU_KEY_PREFIX, UNIT_LABELS } from "@/lib/constants";
import { OrderForm } from "@/components/order/OrderForm";
import { DeliveryWeatherBanner } from "@/components/shared/DeliveryWeatherBanner";
import { GreenhouseReadyBanner } from "@/components/shared/GreenhouseReadyBanner";
import { EmptyState } from "@/components/shared/EmptyState";
import { PickCustomDateLink } from "@/components/order/PickCustomDateLink";
import { DateChips } from "@/components/order/DateChips";
import { mapReorder } from "@/lib/order/reorder";
import { fetchAvailabilityWithRollover, materializeRollover } from "@/lib/availability";
import { getReadyMicrogreens } from "@/lib/microgreens/getReadyToHarvest";
import { PlanterBedsBanner } from "@/components/shared/PlanterBedsBanner";
import { getPlanterBedsForOrder } from "@/lib/planter-beds/server";
import { buildOrderKey } from "@/lib/order-keys";
import { enumerateCells } from "@/lib/order/lines";
import { resolveUnits } from "@/lib/order-availability";
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
  searchParams: Promise<{ edit?: string; date?: string; reorder?: string; q?: string }>;
}) {
  const { edit: editOrderId, date: dateOverride, reorder: reorderId, q: searchParam } = await searchParams;
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
  // Earliest orderable date, farm-local. Before 3:30 PM Pacific that's today;
  // after that it rolls to tomorrow — today's harvest is done, so a late
  // order must land on the NEXT harvest day, not a still-open same-day date.
  const minOrderable = minOrderableDatePacific();

  // If editing, fetch the existing order to get its delivery date and quantities.
  // We also pull unit_type/size_label/color_key so the hydrated quantity keys
  // match what OrderForm.enumerateKeys() will produce — without those, a chef
  // who ordered "5 sm + 3 lg" would see all 8 fall onto a single bare-id key
  // and the multi-unit/size selection state would silently reset.
  let initialQuantities: Record<string, number> = {};
  let initialColors: Record<string, string[]> = {};
  let initialVarieties: Record<string, string[]> = {};
  let initialEventChecked: Record<string, boolean> = {};
  let initialSplitOpen: Record<string, boolean> = {};
  let initialItemNotes: Record<string, string> = {};
  let initialNotes = "";
  let targetDate: string | null = null;
  // Every hydrated line's quantity key + a human label, so that once this
  // date's availability is known we can name the lines the form can't place
  // (and would therefore drop on a replace-save).
  const hydratedLines: { key: string; label: string }[] = [];

  if (editOrderId) {
    // available_units is part of the join on purpose: the form decides
    // "multi-unit" from resolveUnits(item, available_units), so hydration
    // must too, or a "sm,lg" item overridden to "lg" hydrates under
    // id__unit:lg while the form only renders the bare id — the quantity is
    // invisible and lost on save.
    const { data: existingOrder } = await supabase
      .from("orders")
      .select(`
        id, delivery_date, freeform_notes, status,
        order_items(
          quantity_requested, unit_type, size_label, color_key, variety_key, menu_section, notes,
          availability_items(id, status, available_units, item:items(name, unit_type))
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
        const hasMultiUnits = resolveUnits(
          { unit_type: String(ai.item?.unit_type ?? "") },
          ai.available_units,
        ).length > 1;
        const persistedUnit: string | null = oi.unit_type ?? null;
        const persistedSize: string | null = oi.size_label ?? null;

        // Mirror the key shapes OrderForm.enumerateKeys() yields so the
        // hydrated quantities land on the same keys the form computes.
        let key = buildOrderKey(aiId, {
          unit: persistedUnit,
          size: persistedSize,
          hasMultiUnits,
        });
        // Row notes key on the row id (prefixed for a split's event portion).
        let noteKey = aiId;
        if (oi.menu_section === "events") {
          if (aiIdsWithRegular.has(aiId)) {
            // Split line — the event portion lives under the prefixed keys.
            key = `${EVENT_MENU_KEY_PREFIX}${key}`;
            noteKey = `${EVENT_MENU_KEY_PREFIX}${aiId}`;
            initialSplitOpen[aiId] = true;
          } else {
            // Whole item was for the event — hydrate as the checkmark.
            initialEventChecked[aiId] = true;
          }
        }

        initialQuantities[key] = (initialQuantities[key] ?? 0) + Number(oi.quantity_requested ?? 0);
        const unitLabel = persistedUnit
          ? ((UNIT_LABELS as Record<string, string>)[persistedUnit] ?? persistedUnit.toUpperCase())
          : null;
        hydratedLines.push({
          key,
          label: [String(ai.item?.name ?? "Item"), unitLabel, persistedSize].filter(Boolean).join(" · "),
        });
        if (oi.color_key) {
          initialColors[key] = String(oi.color_key).split(",").filter(Boolean);
        }
        if (oi.variety_key) {
          initialVarieties[key] = String(oi.variety_key).split(",").filter(Boolean);
        }
        if (oi.notes) {
          initialItemNotes[noteKey] = String(oi.notes);
        }
      }
    }
  }

  // Find the delivery date to show: explicit ?date= override (off-schedule
  // ordering) → the edited order's date → next open date.
  let deliveryDate: any = null;

  if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride) && dateOverride >= minOrderable) {
    const { data: explicit } = await supabase
      .from("delivery_dates")
      .select("id, date, day_of_week, ordering_open")
      .eq("date", dateOverride)
      .eq("ordering_open", true)
      .single() as any;
    deliveryDate = explicit;
  }

  if (!deliveryDate && targetDate && targetDate >= minOrderable) {
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
    initialVarieties = {};
    initialItemNotes = {};
    initialEventChecked = {};
    initialSplitOpen = {};
    initialNotes = "";
    const { data: nextDate } = await supabase
      .from("delivery_dates")
      .select("id, date, day_of_week, ordering_open")
      .gte("date", minOrderable)
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
  // the form but Submit fails with "the availability list changed" — the
  // IDs were for the prior date.
  //
  // Render the rows materializeRollover hands back (already carrying the
  // target-date ids). Do NOT re-run fetchAvailabilityWithRollover here:
  // React memoizes identical GETs within one server render, so the
  // "refetch" replayed the pre-insert result and shipped prior-date ids
  // (2026-09-03 incident — see materializeRollover's doc comment).
  if (isInherited && (rawItems ?? []).length > 0) {
    const adminForMaterialize = createAdminClient();
    rawItems = await materializeRollover(adminForMaterialize, rawItems!, deliveryDate.date);
  }

  const availabilityItems: AvailabilityItemWithItem[] = (rawItems ?? []).filter(
    (ai: any) => ai.item && !ai.item.is_archived,
  );

  const isEditing = editOrderId && targetDate === deliveryDate.date;

  // ── Edit mode: which hydrated lines can the form actually place? ──
  // The form only renders cells enumerateCells() yields for the rows it
  // shows (status != unavailable, not archived). A line whose key isn't
  // among them — unit/size no longer offered this cycle, or the item flipped
  // to unavailable after the order was placed — would sit invisibly in the
  // maps and vanish on the replace-save. Strip it and tell the chef instead.
  let editingDropped: string[] = [];
  if (isEditing && hydratedLines.length > 0) {
    const placeable = new Set<string>();
    for (const ai of availabilityItems) {
      if (ai.status === "unavailable") continue;
      for (const { key } of enumerateCells(ai)) placeable.add(key);
    }
    const realKey = (key: string) =>
      key.startsWith(EVENT_MENU_KEY_PREFIX) ? key.slice(EVENT_MENU_KEY_PREFIX.length) : key;
    const droppedLabels = new Set<string>();
    for (const { key, label } of hydratedLines) {
      if (placeable.has(realKey(key))) continue;
      droppedLabels.add(label);
      delete initialQuantities[key];
      delete initialColors[key];
      delete initialVarieties[key];
    }
    editingDropped = Array.from(droppedLabels);
  }

  // ── Reorder: prefill from a past order, mapped onto THIS date's rows ──
  // (RLS scopes the read to the chef's own restaurant.)
  let reorderPrefill: ReturnType<typeof mapReorder> | null = null;
  let reorderFromDate: string | null = null;
  if (reorderId && !isEditing) {
    const { data: past } = await supabase
      .from("orders")
      .select(`
        id, delivery_date,
        order_items(
          quantity_requested, unit_type, size_label, color_key, variety_key, menu_section,
          availability_items(item_id, item:items(id, name))
        )
      `)
      .eq("id", reorderId)
      .single() as any;
    if (past) {
      reorderFromDate = past.delivery_date;
      const lines = (past.order_items ?? [])
        .filter((oi: any) => oi.availability_items?.item_id)
        .map((oi: any) => ({
          itemId: oi.availability_items.item_id as string,
          itemName: (oi.availability_items.item?.name as string) ?? "Item",
          quantity: Number(oi.quantity_requested ?? 0),
          unitType: oi.unit_type ?? null,
          sizeLabel: oi.size_label ?? null,
          colorKey: oi.color_key ?? null,
          varietyKey: oi.variety_key ?? null,
          menuSection: oi.menu_section ?? null,
        }));
      reorderPrefill = mapReorder(lines, availabilityItems as any);
    }
  }

  // ── Independent reads, in parallel: "Last order" filter, date chips, the
  // order that already exists for this date, and the two pick-it-yourself
  // banners (greenhouse microgreens + restaurant planter beds). None depends
  // on another, so they share one round-trip instead of a serial waterfall.
  const [{ data: lastOrder }, { data: openDates }, { data: sameDateOrder }, readyMicrogreens, planterBeds] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, delivery_date, order_items(availability_items(item_id))")
        .eq("restaurant_id", restaurant.id)
        .in("status", ["submitted", "in_progress", "fulfilled"])
        .neq("id", editOrderId ?? reorderId ?? "00000000-0000-0000-0000-000000000000")
        .order("delivery_date", { ascending: false })
        .limit(1)
        .maybeSingle() as any,
      supabase
        .from("delivery_dates")
        .select("date, day_of_week")
        .eq("ordering_open", true)
        .gte("date", minOrderable)
        .order("date", { ascending: true })
        .limit(5) as any,
      // The chef-editable order for (restaurant, date), if any — the same
      // row POST /api/orders finds and MERGES into when a submit arrives
      // without editing_order_id. Chef orders never carry event_date (the
      // partial unique index in migration 070 keys on that), so this is at
      // most one row. Skipped in edit mode: that order IS the one being
      // edited.
      isEditing
        ? Promise.resolve({ data: null })
        : (supabase
            .from("orders")
            .select("id, order_items(id)")
            .eq("restaurant_id", restaurant.id)
            .eq("delivery_date", deliveryDate.date)
            .is("event_date", null)
            .in("status", ["draft", "submitted"])
            .limit(1)
            .maybeSingle() as any),
      // Microgreens ready to cut in the greenhouse right now — surfaced so
      // chefs and the bar team harvest from our trays instead of ordering
      // from Meadowood.
      getReadyMicrogreens(),
      getPlanterBedsForOrder(restaurant.slug),
    ]);
  const existingOrder: { id: string; lineCount: number } | null = sameDateOrder
    ? { id: sameDateOrder.id as string, lineCount: ((sameDateOrder.order_items ?? []) as unknown[]).length }
    : null;
  const lastOrderItemIds: string[] = Array.from(
    new Set(
      ((lastOrder?.order_items ?? []) as any[])
        .map((oi) => oi.availability_items?.item_id as string | undefined)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const lastOrderDate: string | null = lastOrder?.delivery_date ?? null;
  const chipDates: string[] = ((openDates ?? []) as Array<{ date: string }>).map((d) => d.date);
  if (!chipDates.includes(deliveryDate.date)) chipDates.unshift(deliveryDate.date);
  const customChipDates = ((openDates ?? []) as Array<{ date: string; day_of_week: string | null }>)
    .filter((d) => d.day_of_week === "custom")
    .map((d) => d.date);

  const deliveryDateFormatted = formatDeliveryDate(deliveryDate.date);

  return (
    <main className="min-h-screen bg-farm-cream">
      <header className="page-header">
        <h1 className="page-title">{isEditing ? "Edit Order" : "Order"} for {deliveryDateFormatted}</h1>
        <p className="text-base sm:text-sm font-semibold sm:font-medium text-white/90">{restaurant.name}</p>
        {closesTodayPacific(deliveryDate.date) && (
          <p className="mt-1 text-xs text-white/80">
            Ordering for today closes at {ORDER_CUTOFF_LABEL}. After that, orders go to the next delivery day.
          </p>
        )}
      </header>

      {/* Delivery-date chips + off-schedule affordance. Hidden while editing:
          an edit is pinned to the order's own date. */}
      {!isEditing && (
        <>
          <DateChips
            dates={chipDates}
            activeDate={deliveryDate.date}
            customDates={customChipDates}
          />
          <PickCustomDateLink key={deliveryDate.date} currentDate={deliveryDate.date} />
        </>
      )}

      <div className="px-4 pt-4 space-y-4">
        <DeliveryWeatherBanner
          deliveryDate={deliveryDate.date}
          deliveryDateFormatted={deliveryDateFormatted}
        />
        <GreenhouseReadyBanner crops={readyMicrogreens} />
        <PlanterBedsBanner groups={planterBeds} />
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
        initialQuantities={isEditing ? initialQuantities : reorderPrefill?.quantities}
        initialColors={isEditing ? initialColors : reorderPrefill?.colors}
        initialVarieties={isEditing ? initialVarieties : reorderPrefill?.varieties}
        initialEventChecked={isEditing ? initialEventChecked : reorderPrefill?.eventChecked}
        initialSplitOpen={isEditing ? initialSplitOpen : reorderPrefill?.splitOpen}
        initialItemNotes={isEditing ? initialItemNotes : undefined}
        initialNotes={isEditing ? initialNotes : undefined}
        editingOrderId={isEditing ? editOrderId : undefined}
        editingDropped={isEditing ? editingDropped : undefined}
        existingOrder={isEditing ? null : existingOrder}
        reorderNotice={
          reorderPrefill && reorderFromDate
            ? { fromDate: reorderFromDate, placed: reorderPrefill.placed, missing: reorderPrefill.missing }
            : undefined
        }
        lastOrderItemIds={lastOrderItemIds}
        lastOrderDate={lastOrderDate}
        initialSearch={typeof searchParam === "string" ? searchParam.slice(0, 80) : undefined}
      />
    </main>
  );
}
