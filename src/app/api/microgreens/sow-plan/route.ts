import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { computeSowPlan } from "@/lib/microgreens/sowPlan";
import { PLAN_HORIZON_DAYS } from "@/lib/microgreens/constants";

export const revalidate = 60; // 60s cache

export async function GET(_req: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + PLAN_HORIZON_DAYS * 24 * 3600 * 1000);
  const today = now.toISOString().slice(0, 10);
  const horizonIso = horizon.toISOString().slice(0, 10);
  const lookbackStart = new Date(now.getTime() - 60 * 24 * 3600 * 1000)
    .toISOString().slice(0, 10);

  const [{ data: crops }, { data: demand }, { data: batches }, { data: trays },
    { data: deliveryDates }, { data: history }] = await Promise.all([
    (admin as any).from("microgreen_crops").select("*").eq("is_active", true),
    (admin as any).from("microgreen_demand").select("*"),
    (admin as any).from("microgreen_batches").select("*"),
    (admin as any).from("microgreen_trays").select("*"),
    (admin as any).from("delivery_dates")
      .select("delivery_date").gte("delivery_date", today).lte("delivery_date", horizonIso),
    (admin as any).from("delivery_items")
      .select("item_id, quantity_oz, deliveries!inner(delivery_date)")
      .gte("deliveries.delivery_date", lookbackStart),
  ]);

  const historicalDeliveryItems = (history ?? []).map((row: any) => ({
    item_id: row.item_id,
    quantity_oz: Number(row.quantity_oz ?? 0),
    delivery_date: row.deliveries?.delivery_date,
  })).filter((r: any) => r.delivery_date);

  const plan = computeSowPlan({
    crops: crops ?? [],
    demand: demand ?? [],
    batches: batches ?? [],
    trays: trays ?? [],
    deliveryDates: (deliveryDates ?? []).map((d: any) => d.delivery_date),
    historicalDeliveryItems,
    now,
  });

  return NextResponse.json({ plan });
}
