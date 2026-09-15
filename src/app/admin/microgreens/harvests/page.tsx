import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { EmptyState } from "@/components/shared/EmptyState";
import { harvestUnitLabel } from "@/lib/microgreens/types";
import { formatDateTimePacific } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  return formatDateTimePacific(iso);
}

export default async function HarvestLogPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("microgreen_harvests")
    .select("*, tray:microgreen_trays(tray_label, batch:microgreen_batches(crop:microgreen_crops(name))), delivery:deliveries(delivery_date)")
    .order("harvested_at", { ascending: false }).limit(200);

  const harvests = data ?? [];

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Harvest Log"
        subtitle={`${harvests.length} harvest${harvests.length === 1 ? "" : "s"} logged`}
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-3xl mx-auto">
        {harvests.length === 0 ? (
          <EmptyState
            flower="dill"
            title="No harvests logged yet"
            body="Harvests are logged from a tray's page when it's cut."
            cta={{ label: "Trays", href: "/admin/microgreens/trays" }}
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
                    {formatWhen(h.harvested_at)}
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
