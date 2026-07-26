import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDaysISO, todayPacific } from "@/lib/utils";
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
  const today = todayPacific();
  const horizonIso = addDaysISO(today, PLAN_HORIZON_DAYS);

  const [{ data: crops }, { data: demand }, { data: batches }, { data: trays },
    { data: deliveryDates }] = await Promise.all([
    (admin as any).from("microgreen_crops").select("*").eq("is_active", true),
    (admin as any).from("microgreen_demand").select("*"),
    (admin as any).from("microgreen_batches").select("*"),
    (admin as any).from("microgreen_trays").select("*"),
    (admin as any).from("delivery_dates")
      .select("delivery_date").gte("delivery_date", today).lte("delivery_date", horizonIso),
  ]);

  const plan = computeSowPlan({
    crops: crops ?? [],
    demand: demand ?? [],
    batches: batches ?? [],
    trays: trays ?? [],
    deliveryDates: (deliveryDates ?? []).map((d: any) => d.delivery_date),
    now,
  });

  return NextResponse.json({ plan });
}
