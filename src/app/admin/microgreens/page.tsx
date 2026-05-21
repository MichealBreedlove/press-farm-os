import Link from "next/link";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSowPlan } from "@/lib/microgreens/sowPlan";
import { PLAN_HORIZON_DAYS } from "@/lib/microgreens/constants";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic"; // sow plan must reflect today

export default async function MicrogreensDashboardPage() {
  const admin = createAdminClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + PLAN_HORIZON_DAYS * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);

  const [{ data: crops }, { data: demand }, { data: batches }, { data: trays },
    { data: deliveryDates }, { data: deliveries }] = await Promise.all([
    (admin as any).from("microgreen_crops").select("*").eq("is_active", true),
    (admin as any).from("microgreen_demand").select("*"),
    (admin as any).from("microgreen_batches").select("*"),
    (admin as any).from("microgreen_trays").select("*"),
    (admin as any).from("delivery_dates").select("delivery_date")
      .gte("delivery_date", today).lte("delivery_date", horizon),
    (admin as any).from("deliveries")
      .select("id, delivery_date, restaurant:restaurants(name)")
      .gte("delivery_date", today).lte("delivery_date", horizon)
      .order("delivery_date"),
  ]);

  const plan = computeSowPlan({
    crops: crops ?? [], demand: demand ?? [], batches: batches ?? [], trays: trays ?? [],
    deliveryDates: (deliveryDates ?? []).map((d: any) => d.delivery_date),
    now,
  });

  const flatDeliveries = (deliveries ?? []).map((d: any) => ({
    id: d.id,
    delivery_date: d.delivery_date,
    restaurant_name: d.restaurant?.name,
  }));

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Production"
        title="Microgreens"
        subtitle={`${(crops ?? []).length} crops · ${(trays ?? []).filter((t: any) => !["terminated","lost"].includes(t.status)).length} trays in flight`}
      />
      <div className="px-4 max-w-3xl mx-auto space-y-6">
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/microgreens/crops" className="badge-blue">Crops</Link>
          <Link href="/admin/microgreens/demand" className="badge-blue">Demand</Link>
          <Link href="/admin/microgreens/trays" className="badge-blue">Trays</Link>
          <Link href="/admin/microgreens/calendar" className="badge-blue">Calendar</Link>
          <Link href="/admin/microgreens/harvests" className="badge-blue">Harvests</Link>
        </nav>
        <DashboardClient
          plan={plan}
          deliveries={flatDeliveries}
          crops={(crops ?? []).map((c: any) => ({
            id: c.id,
            name: c.name,
            variety: c.variety,
            blackout_days: c.blackout_days,
            ideal_harvest_day: c.ideal_harvest_day,
          }))}
        />
      </div>
    </main>
  );
}
