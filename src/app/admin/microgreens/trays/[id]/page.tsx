import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { StageBadge } from "@/components/admin/microgreens/StageBadge";
import { StageTimeline } from "@/components/admin/microgreens/StageTimeline";

export const dynamic = "force-dynamic";

export default async function TrayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: tray } = await (admin as any)
    .from("microgreen_trays")
    .select("*, batch:microgreen_batches(*, crop:microgreen_crops(*))")
    .eq("id", id).maybeSingle();
  if (!tray) notFound();

  const { data: harvests } = await (admin as any)
    .from("microgreen_harvests")
    .select("*, delivery:deliveries(delivery_date, restaurant:restaurants(name))")
    .eq("tray_id", id)
    .order("harvested_at", { ascending: false });

  const crop = tray.batch?.crop;
  const totalYield = (harvests ?? []).reduce((s: number, h: any) => s + Number(h.yield_oz), 0);

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens / Trays"
        title={tray.tray_label}
        subtitle={crop ? `${crop.name}${crop.variety ? ` — ${crop.variety}` : ""}` : undefined}
        backHref="/admin/microgreens/trays"
      />
      <div className="px-4 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <StageBadge status={tray.status} />
          <span className="text-sm text-farm-muted">sown {tray.sow_date}</span>
        </div>

        {crop && <StageTimeline current={tray.status} crop={crop} />}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2">
            Harvest history ({totalYield.toFixed(1)} oz total)
          </h2>
          {(harvests ?? []).length === 0 ? (
            <p className="text-sm text-farm-muted">No harvests logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(harvests ?? []).map((h: any) => (
                <li key={h.id} className="p-2 bg-white rounded border border-farm-muted/15 flex justify-between">
                  <span>{new Date(h.harvested_at).toLocaleString()}</span>
                  <span className="font-medium">{h.yield_oz} oz</span>
                  <span className="text-xs text-farm-muted">
                    {h.delivery?.delivery_date ?? "unassigned"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {tray.lost_reason && (
          <p className="text-sm text-red-700">Lost: {tray.lost_reason}</p>
        )}
      </div>
    </main>
  );
}
