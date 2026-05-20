"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TaskCard } from "@/components/admin/microgreens/TaskCard";
import { SowModal } from "@/components/admin/microgreens/SowModal";
import { HarvestForm } from "@/components/admin/microgreens/HarvestForm";
import type { SowPlan, SowTask, HarvestTask, AdvanceTask } from "@/lib/microgreens/types";

type Delivery = { id: string; delivery_date: string; restaurant_name?: string };

export function DashboardClient({ plan, deliveries }: { plan: SowPlan; deliveries: Delivery[] }) {
  const router = useRouter();
  const [sowing, setSowing] = useState<SowTask | null>(null);
  const [harvesting, setHarvesting] = useState<HarvestTask | null>(null);
  const overdueCount =
    plan.overdue.sow.length + plan.overdue.advance.length + plan.overdue.harvest.length;

  async function advance(task: AdvanceTask) {
    const res = await fetch(`/api/microgreens/trays/${task.tray.id}/advance`, { method: "POST" });
    if (res.ok) router.refresh();
  }

  return (
    <>
      {overdueCount > 0 && (
        <div className="p-3 rounded bg-red-50 border border-red-400 text-red-800 text-sm">
          ⚠ {overdueCount} overdue task{overdueCount > 1 ? "s" : ""}
          {plan.overdue.sow.length > 0 && ` · ${plan.overdue.sow.length} sow`}
          {plan.overdue.advance.length > 0 && ` · ${plan.overdue.advance.length} advance`}
          {plan.overdue.harvest.length > 0 && ` · ${plan.overdue.harvest.length} harvest`}
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide mb-2">Sow today</h2>
        {plan.sow_today.length === 0 ? (
          <p className="text-sm text-farm-muted">Nothing to sow today.</p>
        ) : (
          <div className="space-y-2">
            {plan.sow_today.map((t, i) => (
              <TaskCard
                key={i}
                title={`Sow ${t.trays_to_sow} trays of ${t.crop.name}`}
                subtitle={`For ${t.delivery_date} delivery · ${t.expected_oz} oz needed · ${t.trays_in_flight} in flight`}
                warning={t.is_warning ? `History suggests ${t.forecast_oz.toFixed(1)} oz (vs manual ${t.manual_oz} oz)` : undefined}
                tone={t.is_warning ? "warning" : "default"}
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
                subtitle={`day ${t.days_since_sow}${t.kind === "continuous-ongoing" ? " · continuous" : ""}`}
                action={<button className="btn-primary" onClick={() => setHarvesting(t)}>Log harvest</button>}
              />
            ))}
          </div>
        )}
      </section>

      {sowing && <SowModal task={sowing} onClose={() => setSowing(null)} />}
      {harvesting && <HarvestForm task={harvesting} deliveries={deliveries} onClose={() => setHarvesting(null)} />}
    </>
  );
}
