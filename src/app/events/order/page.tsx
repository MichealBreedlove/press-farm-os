import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDeliveryDate, todayPacific } from "@/lib/utils";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { EmptyState } from "@/components/shared/EmptyState";
import { GreenhouseReadyBanner } from "@/components/shared/GreenhouseReadyBanner";
import { fetchAvailabilityWithRollover, materializeRollover } from "@/lib/availability";
import { getReadyMicrogreens } from "@/lib/microgreens/getReadyToHarvest";
import { EventOrderClient } from "./EventOrderClient";
import type { AvailabilityItemWithItem } from "@/types";

/**
 * /events/order — Events-team ordering system (Server Component).
 *
 * Separate from the chef /order form and the chef /events request flow. The
 * Events team picks the event date AND the delivery date, then orders from the
 * availability published for that delivery date. Submissions auto-confirm into
 * the orders system (no admin review). Gated to the shared Events account.
 *
 * The delivery date is chosen on the form; selecting one reloads this page with
 * ?deliveryDate= so the server can fetch (and materialize) that date's
 * availability — mirroring how /order handles off-schedule dates.
 */
export default async function EventOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ deliveryDate?: string; eventDate?: string; eventName?: string }>;
}) {
  const { deliveryDate: deliveryDateParam, eventDate, eventName } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Gate: Events account only (restaurant slug 'events').
  const { data: membership } = (await (supabase as any)
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name, slug)")
    .eq("user_id", user.id)
    .single()) as any;

  const restaurant = membership?.restaurants;
  // No restaurant link (e.g. an admin) → let the root router send them to the
  // right home. Any non-Events account → the regular chef order form.
  if (!restaurant) redirect("/");
  if (restaurant.slug !== "events") redirect("/order");

  const today = todayPacific();

  // Open, upcoming delivery dates the Events team can deliver on.
  const { data: dateRows } = (await (supabase as any)
    .from("delivery_dates")
    .select("date, day_of_week, ordering_open")
    .gte("date", today)
    .eq("ordering_open", true)
    .order("date", { ascending: true })
    .limit(30)) as any;

  const deliveryDates: { date: string; label: string }[] = (dateRows ?? []).map((d: any) => ({
    date: d.date,
    label: formatDeliveryDate(d.date),
  }));

  // Validate the requested delivery date against the open set, then fetch that
  // date's published Events availability (auto-rollover + materialize so the
  // submit endpoint's exact-date id check passes — same pattern as /order).
  const selectedDeliveryDate =
    deliveryDateParam && deliveryDates.some((d) => d.date === deliveryDateParam)
      ? deliveryDateParam
      : null;

  let availabilityItems: AvailabilityItemWithItem[] = [];
  if (selectedDeliveryDate) {
    let { data: rawItems, isInherited } = await fetchAvailabilityWithRollover(supabase, {
      deliveryDate: selectedDeliveryDate,
      restaurantId: restaurant.id,
      withItem: true,
      hideUnavailable: true,
    });

    if (isInherited && (rawItems ?? []).length > 0) {
      await materializeRollover(createAdminClient(), rawItems!, selectedDeliveryDate);
      const refetched = await fetchAvailabilityWithRollover(supabase, {
        deliveryDate: selectedDeliveryDate,
        restaurantId: restaurant.id,
        withItem: true,
        hideUnavailable: true,
      });
      rawItems = refetched.data;
    }

    availabilityItems = (rawItems ?? []).filter(
      (ai: any) => ai.item && !ai.item.is_archived,
    );
  }

  // Microgreens ready to cut in the greenhouse right now — surfaced so the
  // events/bar team harvest from our trays instead of ordering from Meadowood.
  const readyMicrogreens = await getReadyMicrogreens();

  return (
    <main className="pb-24 bg-farm-cream min-h-screen">
      <EditorialHero
        eyebrow="Events Team"
        title="Place an Event Order"
        subtitle="Pick the event date and the delivery date, then order from what's available."
        flower="marigold"
      />
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
        <GreenhouseReadyBanner crops={readyMicrogreens} />
        {deliveryDates.length === 0 ? (
          <EmptyState
            flower="squash-blossom"
            title="No delivery dates open"
            body="There are no upcoming delivery dates open for ordering. Check back soon or contact Press Farm."
          />
        ) : (
          <EventOrderClient
            deliveryDates={deliveryDates}
            selectedDeliveryDate={selectedDeliveryDate}
            availabilityItems={availabilityItems}
            initialEventDate={eventDate ?? ""}
            initialEventName={eventName ?? ""}
            today={today}
          />
        )}
      </div>
    </main>
  );
}
