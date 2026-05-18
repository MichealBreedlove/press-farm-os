import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { StageBadge } from "@/components/admin/microgreens/StageBadge";

export const dynamic = "force-dynamic";

export default async function TraysListPage({ searchParams }: { searchParams: { status?: string } }) {
  const admin = createAdminClient();
  let q = (admin as any).from("microgreen_trays")
    .select("*, batch:microgreen_batches(crop:microgreen_crops(name))")
    .order("sow_date", { ascending: false }).limit(200);
  if (searchParams.status) q = q.eq("status", searchParams.status);
  const { data: trays } = await q;

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Trays"
        subtitle={`${(trays ?? []).length} shown`}
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-4xl mx-auto">
        <div className="mb-4 flex gap-2 text-xs flex-wrap">
          <Link href="/admin/microgreens/trays" className="badge-blue">All</Link>
          {["soaking", "blackout", "light", "harvesting", "terminated", "lost"].map((s) => (
            <Link key={s} href={`/admin/microgreens/trays?status=${s}`} className="badge-blue capitalize">{s}</Link>
          ))}
        </div>
        <ul className="space-y-2">
          {(trays ?? []).map((t: any) => (
            <li key={t.id}>
              <Link href={`/admin/microgreens/trays/${t.id}`}
                className="block p-3 rounded border border-farm-muted/20 hover:border-farm-green flex items-center gap-3">
                <span className="font-mono text-xs">{t.tray_label}</span>
                <span className="flex-1 text-sm">{t.batch?.crop?.name ?? "—"}</span>
                <StageBadge status={t.status} />
                <span className="text-xs text-farm-muted">{t.sow_date}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
