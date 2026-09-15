import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { EmptyState } from "@/components/shared/EmptyState";
import { harvestUnitLabel } from "@/lib/microgreens/types";
import { addDaysISO, formatDateTimePacific, todayPacific } from "@/lib/utils";
import { HarvestLogForm } from "./HarvestLogForm";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ crop?: string }>;
}

export default async function HarvestLogPage({ searchParams }: Props) {
  const { crop: cropFilter } = await searchParams;
  const admin = createAdminClient() as any;
  const today = todayPacific();

  const [{ data }, { data: trayRows }, { data: deliveryRows }] = await Promise.all([
    admin
      .from("microgreen_harvests")
      .select("*, tray:microgreen_trays(tray_label, batch:microgreen_batches(crop:microgreen_crops(name))), delivery:deliveries(delivery_date)")
      .order("harvested_at", { ascending: false })
      .limit(300),
    // Trays that can be cut right now, for the inline log form.
    admin
      .from("microgreen_trays")
      .select("id, tray_label, status, batch:microgreen_batches(crop:microgreen_crops(name))")
      .in("status", ["light", "harvesting"])
      .order("tray_label"),
    admin
      .from("deliveries")
      .select("id, delivery_date, restaurant:restaurants(name)")
      .gte("delivery_date", addDaysISO(today, -3))
      .lte("delivery_date", addDaysISO(today, 14))
      .order("delivery_date"),
  ]);

  const all = (data ?? []) as any[];
  const cropNames = Array.from(
    new Set(all.map((h) => h.tray?.batch?.crop?.name).filter(Boolean) as string[]),
  ).sort();
  const harvests = cropFilter ? all.filter((h) => h.tray?.batch?.crop?.name === cropFilter) : all;

  const trays = ((trayRows ?? []) as any[]).map((t) => ({
    id: t.id as string,
    label: (t.tray_label as string) ?? "—",
    crop: (t.batch?.crop?.name as string) ?? "—",
    status: t.status as string,
  }));
  const deliveries = ((deliveryRows ?? []) as any[]).map((d) => ({
    id: d.id as string,
    delivery_date: d.delivery_date as string,
    restaurant_name: d.restaurant?.name as string | undefined,
  }));

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Harvest Log"
        subtitle={`${all.length} harvest${all.length === 1 ? "" : "s"} logged${cropFilter ? ` · showing ${cropFilter}` : ""}`}
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-3xl mx-auto space-y-4">
        <HarvestLogForm trays={trays} deliveries={deliveries} />

        {cropNames.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4" role="group" aria-label="Filter by crop">
            {[{ name: null as string | null, label: "All" }, ...cropNames.map((n) => ({ name: n, label: n }))].map((c) => {
              const on = (c.name ?? null) === (cropFilter ?? null);
              return (
                <Link
                  key={c.name ?? "all"}
                  href={c.name ? `/admin/microgreens/harvests?crop=${encodeURIComponent(c.name)}` : "/admin/microgreens/harvests"}
                  className={`flex-shrink-0 rounded-full border px-3 min-h-[36px] inline-flex items-center text-xs font-medium transition-colors ${
                    on ? "bg-farm-dark text-white border-farm-dark" : "bg-white text-farm-muted border-farm-dark/10 hover:border-farm-dark/30"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        )}

        {harvests.length === 0 ? (
          <EmptyState
            flower="dill"
            title={cropFilter ? `No ${cropFilter} harvests yet` : "No harvests logged yet"}
            body={cropFilter ? "Clear the filter or log one above." : "Log one above, or from a tray's page when it's cut."}
            cta={cropFilter ? { label: "All crops", href: "/admin/microgreens/harvests" } : { label: "Trays", href: "/admin/microgreens/trays" }}
          />
        ) : (
          <ul className="space-y-2">
            {harvests.map((h: any) => (
              <li
                key={h.id}
                className="bg-white border border-farm-dark/10 rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-farm-dark truncate">
                      {h.tray?.batch?.crop?.name ?? "—"}
                    </span>
                    <span className="font-mono text-[11px] text-farm-muted">
                      {h.tray?.tray_label ?? "—"}
                    </span>
                  </div>
                  <p className="text-[11px] text-farm-muted mt-0.5">
                    {formatDateTimePacific(h.harvested_at)}
                    {" · "}
                    {h.delivery?.delivery_date
                      ? `delivery ${h.delivery.delivery_date}`
                      : "unassigned"}
                  </p>
                </div>
                <span className="text-sm font-semibold text-farm-dark whitespace-nowrap">
                  {h.yield_oz} {harvestUnitLabel(h.unit)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
