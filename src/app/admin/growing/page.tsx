import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { GrowingTabs } from "@/components/admin/GrowingTabs";
import { HarvestBuckets } from "@/components/admin/HarvestBuckets";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import { TRAY_STATUS_LABELS, TRAY_STATUS_COLORS } from "@/lib/microgreens/constants";
import { SEEDS_ENABLED } from "@/lib/constants";
import { formatDateShort, todayPacific, cn } from "@/lib/utils";
import type { MicrogreenTrayStatus } from "@/types/database";

export const dynamic = "force-dynamic";

const PLANTING_STATUS_CLASS: Record<string, string> = {
  planned: "badge-blue",
  planted: "badge-green",
  growing: "badge-green",
  harvesting: "badge-gold",
  terminated: "badge-gray",
  cancelled: "badge-red",
};

const IN_FLIGHT: MicrogreenTrayStatus[] = ["soaking", "blackout", "light", "harvesting"];

/**
 * /admin/growing — one entry point for everything that's in the ground or
 * on a rack: field plantings (Crop Plan), chef-harvested beds (Planter
 * Boxes), seed stock, and the microgreens rack. Each area keeps its own
 * page; this hub shows the live picture and links across.
 */
export default async function GrowingHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient() as any;
  const today = todayPacific();
  const season = Number(today.slice(0, 4));

  const [
    { data: plantings },
    { data: boxes },
    { data: trays },
    { count: cropCount },
    seeds,
    buckets,
  ] = await Promise.all([
    admin
      .from("plantings")
      .select("id, crop_name, variety, status, location, harvest_start, harvest_end, sow_date, transplant_date, items(name)")
      .eq("season", season)
      .order("harvest_start", { ascending: true, nullsFirst: false })
      .limit(400),
    admin.from("planter_boxes").select("id, name, is_active, planter_box_plantings(id, end_date)").limit(200),
    admin.from("microgreen_trays").select("id, status").limit(1000),
    admin.from("microgreen_crops").select("id", { count: "exact", head: true }).eq("is_active", true),
    SEEDS_ENABLED
      ? admin.from("seeds_with_on_hand").select("id, status, is_low").limit(1000)
      : Promise.resolve({ data: [] as any[] }),
    getAvailabilityBuckets(today).catch(() => null),
  ]);

  // ── Field plantings ────────────────────────────────────────────────
  const rows = (plantings ?? []) as any[];
  const active = rows.filter((p) => !["terminated", "cancelled"].includes(p.status));
  const inHarvest = active.filter(
    (p) =>
      p.status === "harvesting" ||
      (p.harvest_start && p.harvest_end && p.harvest_start <= today && today <= p.harvest_end),
  );
  const comingSoon = active
    .filter((p) => p.harvest_start && p.harvest_start > today)
    .slice(0, 6);
  const plannedCount = active.filter((p) => p.status === "planned").length;

  // ── Planter boxes ──────────────────────────────────────────────────
  const boxRows = (boxes ?? []) as any[];
  const activeBoxes = boxRows.filter((b) => b.is_active !== false);
  const livePlantings = boxRows.reduce(
    (s, b) => s + (b.planter_box_plantings ?? []).filter((p: any) => !p.end_date || p.end_date >= today).length,
    0,
  );

  // ── Microgreens ────────────────────────────────────────────────────
  const trayRows = (trays ?? []) as { status: MicrogreenTrayStatus }[];
  const trayByStatus = IN_FLIGHT.map((s) => ({ status: s, n: trayRows.filter((t) => t.status === s).length }));
  const traysInFlight = trayByStatus.reduce((s, x) => s + x.n, 0);

  // ── Seeds ──────────────────────────────────────────────────────────
  const seedRows = ((seeds as any)?.data ?? []) as { status: string; is_low: boolean | null }[];
  const seedsActive = seedRows.filter((s) => s.status === "active").length;
  const seedsLow = seedRows.filter((s) => s.status === "active" && s.is_low).length;

  const cards: { href: string; title: string; stat: string; caption: string; flower: string; warn?: boolean }[] = [
    {
      href: "/admin/crop-plan",
      title: "Crop Plan",
      stat: `${active.length}`,
      caption: `planting${active.length === 1 ? "" : "s"} this season · ${inHarvest.length} in harvest${plannedCount ? ` · ${plannedCount} planned` : ""}`,
      flower: "squash-bud",
    },
    {
      href: "/admin/planter-boxes",
      title: "Planter Boxes",
      stat: `${activeBoxes.length}`,
      caption: `box${activeBoxes.length === 1 ? "" : "es"} · ${livePlantings} live planting${livePlantings === 1 ? "" : "s"}`,
      flower: "rosemary",
    },
    ...(SEEDS_ENABLED
      ? [
          {
            href: "/admin/seeds",
            title: "Seeds",
            stat: `${seedsActive}`,
            caption: seedsLow > 0 ? `active · ${seedsLow} running low` : "active packets",
            flower: "calendula",
            warn: seedsLow > 0,
          },
        ]
      : []),
    {
      href: "/admin/microgreens",
      title: "Microgreens",
      stat: `${traysInFlight}`,
      caption: `tray${traysInFlight === 1 ? "" : "s"} in flight · ${cropCount ?? 0} active crop${(cropCount ?? 0) === 1 ? "" : "s"}`,
      flower: "dill",
    },
  ];

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Growing</h1>
      </header>
      <EditorialHero
        eyebrow="Farm Management"
        title="Growing"
        subtitle={`${inHarvest.length} field crop${inHarvest.length === 1 ? "" : "s"} in harvest · ${traysInFlight} microgreen tray${traysInFlight === 1 ? "" : "s"} in flight · ${livePlantings} planter-box planting${livePlantings === 1 ? "" : "s"}`}
        flower="pea-flower"
        backHref="/admin/dashboard"
      />
      <GrowingTabs active="overview" />

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-8">
        {/* Area cards */}
        <section className="grid grid-cols-2 gap-3">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="card-interactive p-4 relative overflow-hidden min-h-[96px]">
              <img
                src={`/assets/pressfarm/flowers/${c.flower}.png`}
                alt=""
                aria-hidden="true"
                className="absolute right-2 top-1/2 -translate-y-1/2 w-20 h-20 opacity-20 pointer-events-none"
              />
              <p className="text-xs text-farm-muted relative">{c.title}</p>
              <p className={cn("text-2xl font-bold mt-1 relative", c.warn ? "text-pf-master-orange" : "text-farm-green")}>{c.stat}</p>
              <p className="text-[11px] text-farm-muted mt-1 relative leading-snug pr-14">{c.caption}</p>
            </Link>
          ))}
        </section>

        {/* In harvest now */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] tracking-[0.18em] uppercase text-farm-muted font-semibold">In harvest now</h3>
            <Link href="/admin/crop-plan" className="text-xs font-medium text-farm-green hover:underline">
              Crop plan →
            </Link>
          </div>
          {inHarvest.length === 0 ? (
            <p className="text-sm text-farm-muted/80 italic px-1">No field plantings are in their harvest window today.</p>
          ) : (
            <ul className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm divide-y divide-farm-dark/5 overflow-hidden">
              {inHarvest.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-farm-dark truncate">
                      {p.items?.name ?? p.crop_name}
                      {p.variety && <span className="text-farm-muted font-normal"> · {p.variety}</span>}
                    </p>
                    <p className="text-[11px] text-farm-muted mt-0.5">
                      {p.location ?? "—"}
                      {p.harvest_end && ` · through ${formatDateShort(p.harvest_end)}`}
                    </p>
                  </div>
                  <span className={PLANTING_STATUS_CLASS[p.status] ?? "badge-gray"}>{p.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Coming soon */}
        {comingSoon.length > 0 && (
          <section>
            <h3 className="text-[11px] tracking-[0.18em] uppercase text-farm-muted font-semibold mb-3">Opening next</h3>
            <ul className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm divide-y divide-farm-dark/5 overflow-hidden">
              {comingSoon.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-farm-dark truncate">{p.items?.name ?? p.crop_name}</p>
                    <p className="text-[11px] text-farm-muted mt-0.5">{p.location ?? "—"}</p>
                  </div>
                  <span className="text-xs text-farm-dark tabular-nums">{formatDateShort(p.harvest_start)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Microgreens rack */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[11px] tracking-[0.18em] uppercase text-farm-muted font-semibold">Microgreens rack</h3>
            <Link href="/admin/microgreens/trays" className="text-xs font-medium text-farm-green hover:underline">
              Trays →
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {trayByStatus.map((t) => (
              <Link
                key={t.status}
                href={`/admin/microgreens/trays?status=${t.status}`}
                className="card p-3 text-center hover:border-farm-green/40 transition-colors"
              >
                <p className="text-xl font-bold text-farm-dark tabular-nums">{t.n}</p>
                <span className={cn("mt-1 inline-block", TRAY_STATUS_COLORS[t.status])}>{TRAY_STATUS_LABELS[t.status]}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Projected availability — same buckets the calendar shows */}
        {buckets && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] tracking-[0.18em] uppercase text-farm-muted font-semibold">Projected availability</h3>
              <Link href="/admin/calendar" className="text-xs font-medium text-farm-green hover:underline">
                Calendar →
              </Link>
            </div>
            <HarvestBuckets buckets={buckets} />
          </section>
        )}
      </div>
    </main>
  );
}
