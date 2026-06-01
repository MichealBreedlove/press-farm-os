import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { TrayListClient, type TrayRow } from "@/components/admin/microgreens/TrayListClient";
import type { MicrogreenTrayStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string }> };

const STATUS_ORDER: MicrogreenTrayStatus[] = [
  "soaking", "blackout", "light", "harvesting", "terminated", "lost",
];

function daysBetween(fromIso: string, to: Date): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  return Math.round((to.getTime() - a) / (24 * 3600 * 1000));
}

function statusOrder(s: string): number {
  const order: Record<string, number> = {
    soaking: 0, blackout: 1, light: 2, harvesting: 3, terminated: 4, lost: 5,
  };
  return order[s] ?? 99;
}

export default async function TraysListPage({ searchParams }: Props) {
  const { status: statusFilter } = await searchParams;
  const admin = createAdminClient();

  let q = (admin as any).from("microgreen_trays")
    .select(`
      *,
      batch:microgreen_batches(
        id,
        crop:microgreen_crops(name, blackout_days, ideal_harvest_day, is_continuous_harvest, productive_life_days)
      )
    `)
    .order("sow_date", { ascending: false })
    .limit(500);
  if (statusFilter) q = q.eq("status", statusFilter);
  const { data: trays, error } = await q;

  const { data: allTrays } = await (admin as any)
    .from("microgreen_trays")
    .select("status");

  const counts: Record<MicrogreenTrayStatus, number> = {
    soaking: 0, blackout: 0, light: 0, harvesting: 0, terminated: 0, lost: 0,
  };
  for (const t of allTrays ?? []) {
    counts[t.status as MicrogreenTrayStatus] = (counts[t.status as MicrogreenTrayStatus] ?? 0) + 1;
  }
  const total = (allTrays ?? []).length;

  const sortedTrays = [...(trays ?? [])].sort((a: any, b: any) => {
    const sd = statusOrder(a.status) - statusOrder(b.status);
    if (sd !== 0) return sd;
    return (b.sow_date ?? "").localeCompare(a.sow_date ?? "");
  });

  const now = new Date();

  function nextTransitionLabel(tray: any): string | null {
    const crop = tray.batch?.crop;
    if (!crop) return null;
    const sowDate = tray.sow_date;
    if (!sowDate) return null;
    const daysIn = daysBetween(sowDate, now);

    if (tray.status === "soaking") return "→ blackout once soak/presprout completes";
    if (tray.status === "blackout") {
      const remaining = (crop.blackout_days ?? 0) - daysIn;
      if (remaining > 0) return `→ light in ${remaining} d`;
      if (remaining === 0) return "→ light today";
      return `→ light overdue (${Math.abs(remaining)} d late)`;
    }
    if (tray.status === "light") {
      const remaining = (crop.ideal_harvest_day ?? 0) - daysIn;
      if (remaining > 0) return `harvest in ${remaining} d`;
      if (remaining === 0) return "harvest today";
      return `harvest overdue (${Math.abs(remaining)} d late)`;
    }
    if (tray.status === "harvesting" && crop.is_continuous_harvest) {
      const life = crop.productive_life_days ?? 0;
      const remaining = life - daysIn;
      if (remaining > 0) return `continuous · ${remaining} d productive life left`;
      if (remaining === 0) return "continuous · terminate today";
      return `continuous · ${Math.abs(remaining)} d past productive life`;
    }
    return null;
  }

  const rows: TrayRow[] = sortedTrays.map((t: any) => ({
    id: t.id,
    tray_label: t.tray_label,
    status: t.status,
    sow_date: t.sow_date,
    cropName: t.batch?.crop?.name ?? "—",
    daysIn: daysBetween(t.sow_date, now),
    nextTransition: nextTransitionLabel(t),
  }));

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Trays"
        subtitle={
          statusFilter
            ? `Filtered to ${statusFilter} — ${(trays ?? []).length} of ${total}`
            : `${total} trays total · ${counts.soaking + counts.blackout + counts.light + counts.harvesting} active`
        }
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-4xl mx-auto">
        <div className="mb-4 flex gap-2 text-xs flex-wrap">
          <Link
            href="/admin/microgreens/trays"
            className={
              !statusFilter
                ? "px-2.5 py-1 rounded-full bg-farm-dark text-white"
                : "px-2.5 py-1 rounded-full border border-farm-dark/15 text-farm-muted hover:border-farm-dark/30"
            }
          >
            All ({total})
          </Link>
          {STATUS_ORDER.map((s) => {
            const c = counts[s];
            const active = statusFilter === s;
            return (
              <Link
                key={s}
                href={`/admin/microgreens/trays?status=${s}`}
                className={
                  active
                    ? "px-2.5 py-1 rounded-full bg-farm-dark text-white capitalize"
                    : "px-2.5 py-1 rounded-full border border-farm-dark/15 text-farm-muted hover:border-farm-dark/30 capitalize"
                }
              >
                {s} ({c})
              </Link>
            );
          })}
        </div>

        {error && (
          <p className="p-3 mb-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">
            Couldn&apos;t load trays: {(error as any).message}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-farm-muted bg-white border border-farm-dark/10 rounded-xl">
            {statusFilter
              ? `No trays in ${statusFilter} status.`
              : "No trays sown yet. Open the dashboard and tap + Sow ad-hoc to log one."}
          </p>
        ) : (
          <TrayListClient trays={rows} />
        )}
      </div>
    </main>
  );
}
