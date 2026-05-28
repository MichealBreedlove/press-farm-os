import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { Sprout } from "lucide-react";
import { YIELD_UNITS, YIELD_UNIT_LABELS } from "@/lib/microgreens/types";
import { HARVEST_STAGE_LABELS, HARVEST_STAGE_CHIP_CLASS } from "@/lib/microgreens/constants";
import type { MicrogreenCrop } from "@/types/database";

function formatYield(crop: MicrogreenCrop): string {
  const yp = (crop.yield_per_tray ?? {}) as Record<string, number>;
  const parts = YIELD_UNITS.filter((u) => yp[u] != null).map((u) => `${yp[u]} ${YIELD_UNIT_LABELS[u]}`);
  if (parts.length) return `${parts.join(" / ")} per tray`;
  return "yield not set";
}

export default async function CropsListPage() {
  const admin = createAdminClient();
  const { data } = await (admin as any)
    .from("microgreen_crops")
    .select("*")
    .order("name");
  const crops = (data ?? []) as MicrogreenCrop[];

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Variety Library"
        subtitle={`${crops.length} crops · ${crops.filter((c) => c.is_active).length} active`}
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-3xl mx-auto">
        <Link href="/admin/microgreens/crops/new" className="btn-primary mb-4 inline-block">
          + New crop
        </Link>
        <ul className="space-y-2">
          {crops.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/microgreens/crops/${c.id}`}
                className="flex items-center gap-3 p-3 rounded border border-farm-muted/20 hover:border-farm-green"
              >
                <Sprout className="w-5 h-5 text-farm-green shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2">
                    <span>{c.name}{c.variety ? ` — ${c.variety}` : ""}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${HARVEST_STAGE_CHIP_CLASS[c.harvest_stage]}`}
                    >
                      {HARVEST_STAGE_LABELS[c.harvest_stage]}
                    </span>
                    {!c.is_active && (
                      <span className="text-[10px] uppercase tracking-wide text-farm-muted border border-farm-muted/30 rounded px-1.5 py-0.5">
                        inactive
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-farm-muted">
                    {c.ideal_harvest_day}d total · {c.blackout_days}d blackout · {formatYield(c)}
                    {c.is_continuous_harvest && " · continuous"}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
