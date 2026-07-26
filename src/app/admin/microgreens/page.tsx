import Link from "next/link";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysISO, todayPacific } from "@/lib/utils";
import { computeSowPlan } from "@/lib/microgreens/sowPlan";
import { PLAN_HORIZON_DAYS } from "@/lib/microgreens/constants";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic"; // sow plan must reflect today

export default async function MicrogreensDashboardPage() {
  const admin = createAdminClient();
  const now = new Date();
  const today = todayPacific();
  const horizon = addDaysISO(today, PLAN_HORIZON_DAYS);

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
        <nav className="flex flex-wrap gap-2">
          {([
            ["Crops", "/admin/microgreens/crops"],
            ["Demand", "/admin/microgreens/demand"],
            ["Trays", "/admin/microgreens/trays"],
            ["Calendar", "/admin/microgreens/calendar"],
            ["Harvests", "/admin/microgreens/harvests"],
          ] as const).map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center min-h-[40px] px-3.5 py-2 rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-dark hover:border-farm-green hover:text-farm-green transition-colors"
            >
              {label}
            </Link>
          ))}
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
