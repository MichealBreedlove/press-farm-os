import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayPacific } from "@/lib/utils";
import {
  firstSeriesForRestaurant,
  groupPlanterBeds,
  type PlanterBedGroup,
} from "./group";

/**
 * Server-only loader for the chef-facing "In the Planter Beds" list on the
 * order sheet. The planter_box_* tables are admin-only RLS, so this reads
 * through the service-role client and returns names + box numbers only —
 * never the internal notes or production-value figures. Best-effort: any
 * failure returns [] so the banner stays empty and never blocks an order flow
 * (mirrors getReadyMicrogreens). Used by /order + /events/order.
 */
export async function getPlanterBedsForOrder(
  restaurantSlug?: string | null,
): Promise<PlanterBedGroup[]> {
  try {
    const admin = createAdminClient();
    const { data } = await (admin as any)
      .from("planter_box_plantings")
      .select("name, seasonal_months, planter_boxes(name, is_active)")
      .eq("status", "active");
    const rows = ((data ?? []) as any[])
      .filter((r) => r.planter_boxes?.name && r.planter_boxes?.is_active !== false)
      .map((r) => ({
        name: r.name as string,
        box: r.planter_boxes.name as string,
        seasonalMonths: (r.seasonal_months ?? []) as number[],
      }));
    const month = Number(todayPacific().slice(5, 7));
    return groupPlanterBeds(rows, {
      month,
      firstSeries: firstSeriesForRestaurant(restaurantSlug),
    });
  } catch {
    return [];
  }
}
