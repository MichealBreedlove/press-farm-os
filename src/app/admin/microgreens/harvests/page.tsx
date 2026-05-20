import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";

export const dynamic = "force-dynamic";

export default async function HarvestLogPage() {
  const admin = createAdminClient();
  const { data } = await (admin as any)
    .from("microgreen_harvests")
    .select("*, tray:microgreen_trays(tray_label, batch:microgreen_batches(crop:microgreen_crops(name))), delivery:deliveries(delivery_date)")
    .order("harvested_at", { ascending: false }).limit(200);

  return (
    <main className="pb-24">
      <EditorialHero eyebrow="Microgreens" title="Harvest Log" backHref="/admin/microgreens" />
      <div className="px-4 max-w-3xl mx-auto overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-2">When</th>
              <th className="p-2">Crop</th>
              <th className="p-2">Tray</th>
              <th className="p-2">Yield</th>
              <th className="p-2">Delivery</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((h: any) => (
              <tr key={h.id} className="border-t border-farm-muted/15">
                <td className="p-2">{new Date(h.harvested_at).toLocaleString()}</td>
                <td className="p-2">{h.tray?.batch?.crop?.name ?? "—"}</td>
                <td className="p-2 font-mono text-xs">{h.tray?.tray_label ?? "—"}</td>
                <td className="p-2">{h.yield_oz} oz</td>
                <td className="p-2 text-xs text-farm-muted">{h.delivery?.delivery_date ?? "unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
