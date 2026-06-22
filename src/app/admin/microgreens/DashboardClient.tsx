"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskCard } from "@/components/admin/microgreens/TaskCard";
import { SowModal } from "@/components/admin/microgreens/SowModal";
import { AdHocSowModal } from "@/components/admin/microgreens/AdHocSowModal";
import { HarvestForm } from "@/components/admin/microgreens/HarvestForm";
import type { SowPlan, SowTask, HarvestTask, AdvanceTask, DemandLine } from "@/lib/microgreens/types";
import { YIELD_UNIT_LABELS } from "@/lib/microgreens/types";

function formatDemands(demands: DemandLine[]): string {
  return demands
    .map((d) => `${d.quantity} ${YIELD_UNIT_LABELS[d.unit]}`)
    .join(" + ");
}

type Delivery = { id: string; delivery_date: string; restaurant_name?: string };
type AdHocCrop = {
  id: string;
  name: string;
  variety: string | null;
  blackout_days: number;
  ideal_harvest_day: number;
};

export function DashboardClient({
  plan,
  deliveries,
  crops,
}: {
  plan: SowPlan;
  deliveries: Delivery[];
  crops: AdHocCrop[];
}) {
  const router = useRouter();
  const [sowing, setSowing] = useState<SowTask | null>(null);
  const [adHocSowing, setAdHocSowing] = useState(false);
  const [harvesting, setHarvesting] = useState<HarvestTask | null>(null);
  const overdueCount =
    plan.overdue.sow.length + plan.overdue.advance.length + plan.overdue.harvest.length;

  async function advance(task: AdvanceTask) {
    const res = await fetch(`/api/microgreens/trays/${task.tray.id}/advance`, { method: "POST" });
    if (res.ok) router.refresh();
  }

  // "Mark ready" advances a light (or keep-in-blackout) tray into 'harvesting'
  // without logging a yield — it surfaces the crop on the chef/bar order banner.
  async function markReady(trayId: string) {
    const res = await fetch(`/api/microgreens/trays/${trayId}/advance`, { method: "POST" });
    if (res.ok) router.refresh();
  }

  return (
    <>
      {overdueCount > 0 && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <span aria-hidden>⚠</span>
            {overdueCount} overdue task{overdueCount > 1 ? "s" : ""}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plan.overdue.sow.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                {plan.overdue.sow.length} to sow
              </span>
            )}
            {plan.overdue.advance.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                {plan.overdue.advance.length} to advance
              </span>
            )}
            {plan.overdue.harvest.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                {plan.overdue.harvest.length} to harvest
              </span>
            )}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">Sow today</h2>
          <button
            type="button"
            onClick={() => setAdHocSowing(true)}
            className="text-sm px-3 py-1.5 rounded-lg border border-farm-green text-farm-green font-medium hover:bg-farm-green/5 min-h-[36px]"
          >
            + Sow ad-hoc
          </button>
        </div>
        {plan.sow_today.length === 0 ? (
          <p className="text-sm text-farm-muted">
            Nothing scheduled to sow today. Use <span className="text-farm-dark">+ Sow ad-hoc</span> to log a tray anyway.
          </p>
        ) : (
          <div className="space-y-2">
            {plan.sow_today.map((t, i) => (
              <TaskCard
                key={i}
                title={`Sow ${t.trays_to_sow} trays of ${t.crop.name}`}
                subtitle={`For ${t.delivery_date} delivery · ${formatDemands(t.expected_demands)} needed · ${t.trays_in_flight} in flight`}
                warning={t.missing_yield_config ? `Missing yield_per_tray entry for one of the requested units — set it on the crop page so trays_needed is computed correctly.` : undefined}
                tone={t.missing_yield_config ? "warning" : "default"}
                action={<button className="btn-primary" onClick={() => setSowing(t)}>Mark sown</button>}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-2">Advance</h2>
        {plan.advance_today.length === 0 ? (
          <p className="text-sm text-farm-muted">No stage transitions today.</p>
        ) : (
          <div className="space-y-2">
            {plan.advance_today.map((t, i) => (
              <TaskCard
                key={i}
                title={`Move ${t.tray.tray_label} (${t.crop.name})`}
                subtitle={`${t.from_status} → ${t.to_status}`}
                action={<button className="btn-primary" onClick={() => advance(t)}>Advance</button>}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-2">Harvest</h2>
        {plan.harvest_today.length === 0 ? (
          <p className="text-sm text-farm-muted">No harvest tasks today.</p>
        ) : (
          <div className="space-y-2">
            {plan.harvest_today.map((t, i) => (
              <TaskCard
                key={i}
                title={`Harvest ${t.tray.tray_label} (${t.crop.name})`}
                subtitle={`day ${t.days_since_sow}${t.tray.status === "harvesting" ? " · marked ready" : ""}${t.kind === "continuous-ongoing" ? " · continuous" : ""}`}
                action={
                  <div className="flex flex-wrap gap-2">
                    {t.tray.status !== "harvesting" && (
                      <button
                        className="px-4 py-2 text-sm rounded-lg border border-farm-green text-farm-green font-medium hover:bg-farm-green/5"
                        onClick={() => markReady(t.tray.id)}
                      >
                        Mark ready
                      </button>
                    )}
                    <button className="btn-primary" onClick={() => setHarvesting(t)}>Log harvest</button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

      {sowing && <SowModal task={sowing} onClose={() => setSowing(null)} />}
      {adHocSowing && <AdHocSowModal crops={crops} onClose={() => setAdHocSowing(false)} />}
      {harvesting && <HarvestForm task={harvesting} deliveries={deliveries} onClose={() => setHarvesting(null)} />}
    </>
  );
}
