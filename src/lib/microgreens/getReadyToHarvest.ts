import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeReadyToHarvest, type ReadyHarvestCrop } from "./readyToHarvest";

/**
 * Server-only loader for the chef-/bar-facing "Ready in the Greenhouse" banner.
 * The microgreen tables are admin-only RLS, so this reads through the
 * service-role client. Best-effort: any failure returns [] so the banner stays
 * empty and never blocks an order flow (mirrors the weather banner's silent
 * fail). Used by /order and /events/order.
 */
export async function getReadyMicrogreens(): Promise<ReadyHarvestCrop[]> {
  try {
    const admin = createAdminClient();
    const [{ data: crops }, { data: batches }, { data: trays }] = await Promise.all([
      (admin as any).from("microgreen_crops").select("*").eq("is_active", true),
      (admin as any).from("microgreen_batches").select("id, crop_id"),
      (admin as any)
        .from("microgreen_trays")
        .select("*")
        .in("status", ["blackout", "light", "harvesting"]),
    ]);
    return computeReadyToHarvest({
      crops: crops ?? [],
      batches: batches ?? [],
      trays: trays ?? [],
      now: new Date(),
    });
  } catch {
    return [];
  }
}
