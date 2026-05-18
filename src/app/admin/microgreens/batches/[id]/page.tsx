import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { StageBadge } from "@/components/admin/microgreens/StageBadge";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data: batch } = await (admin as any)
    .from("microgreen_batches")
    .select("*, crop:microgreen_crops(*)")
    .eq("id", params.id).maybeSingle();
  if (!batch) notFound();

  const { data: trays } = await (admin as any)
    .from("microgreen_trays").select("*").eq("batch_id", params.id).order("tray_label");

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens / Batches"
        title={batch.crop?.name ?? "Batch"}
        subtitle={`Sown ${batch.sow_date} · ${batch.tray_count} trays · harvest ${batch.planned_harvest_date}`}
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-2xl mx-auto">
        <ul className="space-y-1">
          {(trays ?? []).map((t: any) => (
            <li key={t.id}>
              <Link href={`/admin/microgreens/trays/${t.id}`}
                className="block p-2 rounded border border-farm-muted/15 hover:border-farm-green flex items-center gap-3">
                <span className="font-mono text-xs flex-1">{t.tray_label}</span>
                <StageBadge status={t.status} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
