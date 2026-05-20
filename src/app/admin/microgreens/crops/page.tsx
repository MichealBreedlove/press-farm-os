import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { Sprout } from "lucide-react";
import type { MicrogreenCrop } from "@/types/database";

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
                className="block p-3 rounded border border-farm-muted/20 hover:border-farm-green flex items-center gap-3"
              >
                <Sprout className="w-5 h-5 text-farm-green" />
                <div className="flex-1">
                  <div className="font-medium">{c.name}{c.variety ? ` — ${c.variety}` : ""}</div>
                  <div className="text-xs text-farm-muted">
                    {c.ideal_harvest_day}d total · {c.blackout_days}d blackout · ~{c.expected_yield_oz_per_tray}oz/tray
                    {c.is_continuous_harvest && " · continuous"}
                    {!c.is_active && " · inactive"}
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
