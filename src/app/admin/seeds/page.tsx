import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SEEDS_ENABLED } from "@/lib/constants";
import { SeedsClient } from "./SeedsClient";
import type { SeedWithItem } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminSeedsPage() {
  if (!SEEDS_ENABLED) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: seedsRaw } = await (admin as any)
    .from("seeds_with_on_hand")
    .select("*, item:items(id, name, category)")
    .order("status", { ascending: true })
    .order("variety");

  const seeds = (seedsRaw ?? []) as SeedWithItem[];

  const activeCount = seeds.filter((s) => s.status === "active").length;
  const lowCount = seeds.filter((s) => s.status === "active" && s.is_low).length;
  const exhaustedCount = seeds.filter((s) => s.status === "exhausted").length;
  const currentYear = new Date().getFullYear();
  const oldSeedCount = seeds.filter(
    (s) => s.status === "active" && s.packed_for_year != null && s.packed_for_year <= currentYear - 2,
  ).length;

  const subtitleParts: string[] = [`${activeCount} active`];
  if (lowCount > 0) subtitleParts.push(`${lowCount} low`);
  if (oldSeedCount > 0) subtitleParts.push(`${oldSeedCount} old`);
  const subtitle = subtitleParts.join(" · ");

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Seeds</h1>
      </header>
      <EditorialHero
        eyebrow="Farm Management"
        title="Seed Inventory"
        subtitle={subtitle}
        flower="calendula"
        backHref="/admin/dashboard"
      />

      <div className="px-4 py-4 max-w-3xl mx-auto">
        <SeedsClient
          seeds={seeds}
          stats={{ active: activeCount, low: lowCount, exhausted: exhaustedCount, oldSeed: oldSeedCount }}
        />
      </div>
    </main>
  );
}
