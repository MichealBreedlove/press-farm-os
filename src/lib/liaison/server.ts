import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/fetch-all";
import {
  productionWindowStart,
  summarizeMicrogreens,
  summarizeProduction,
  type MicrogreenStatus,
  type ProductionLine,
  type ProductionSummary,
} from "./production";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Gate for the Farm Liaison portal (/liaison/*): an active liaison, or an
 * admin peeking. Everyone else goes to their own home via "/".
 */
export async function requireLiaisonPage(): Promise<{ fullName: string | null; role: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, is_active, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");
  const ok = profile.role === "admin" || (profile.role === "liaison" && profile.is_active !== false);
  if (!ok) redirect("/");
  return { fullName: profile.full_name ?? null, role: profile.role };
}

/** Delivered product (quantity + dollars) since Jan 1 / six months back. */
export async function loadProductionSummary(admin: AdminClient, today: string): Promise<ProductionSummary> {
  const from = productionWindowStart(today);
  // A year of delivery_items is well past the 1,000-row cap — paginate.
  const { data } = await fetchAllRows<any>((lo, hi) =>
    (admin as any)
      .from("delivery_items")
      .select(`
        id, delivery_id, quantity, unit, line_total,
        items ( name ),
        deliveries!inner ( delivery_date, restaurants ( name ) )
      `)
      .gte("deliveries.delivery_date", from)
      .order("id")
      .range(lo, hi),
  );
  const lines: ProductionLine[] = data.map((r) => ({
    date: r.deliveries?.delivery_date ?? "",
    deliveryId: r.delivery_id,
    restaurant: r.deliveries?.restaurants?.name ?? "Other",
    item: r.items?.name ?? "Unknown item",
    quantity: Number(r.quantity ?? 0),
    unit: String(r.unit ?? ""),
    total: Number(r.line_total ?? 0),
  }));
  return summarizeProduction(lines, today);
}

/** Microgreen trays that are ready to cut or still growing. */
export async function loadMicrogreenStatus(admin: AdminClient): Promise<MicrogreenStatus> {
  const { data } = await (admin as any)
    .from("microgreen_trays")
    .select("status, batch:microgreen_batches ( planned_harvest_date, crop:microgreen_crops ( name ) )")
    .in("status", ["soaking", "blackout", "light", "harvesting"])
    .limit(1000);
  return summarizeMicrogreens(
    ((data ?? []) as any[]).map((r) => ({
      crop: r.batch?.crop?.name ?? "Microgreens",
      status: r.status,
      plannedHarvest: r.batch?.planned_harvest_date ?? null,
    })),
  );
}

/** The next delivery date and whether ordering is open — for the Order door. */
export async function loadNextDelivery(
  admin: AdminClient,
  today: string,
): Promise<{ date: string | null; orderingOpen: boolean }> {
  const { data: next } = await (admin as any)
    .from("delivery_dates")
    .select("date, ordering_open")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return { date: next?.date ?? null, orderingOpen: !!next?.ordering_open };
}
