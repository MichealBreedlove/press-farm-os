import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SEEDS_ENABLED } from "@/lib/constants";
import { SeedDetailClient } from "./SeedDetailClient";
import { flowerImageForName } from "@/lib/flower-images";
import type { SeedWithItem, SeedSowingWithPlanting, SeedGerminationTestRow } from "@/types";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ seedId: string }>;
}

export default async function SeedDetailPage({ params }: PageProps) {
  if (!SEEDS_ENABLED) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { seedId } = await params;
  const admin = createAdminClient();

  const { data: seed } = await (admin as any)
    .from("seeds_with_on_hand")
    .select("*, item:items(id, name, category)")
    .eq("id", seedId)
    .single();

  if (!seed) notFound();

  const [{ data: sowings }, { data: germTests }, { data: itemsRaw }, { data: plantings }] = await Promise.all([
    (admin as any)
      .from("seed_sowings")
      .select("*, planting:plantings(id, crop_name, variety, sow_date)")
      .eq("seed_id", seedId)
      .order("sown_on", { ascending: false }),
    (admin as any)
      .from("seed_germination_tests")
      .select("*")
      .eq("seed_id", seedId)
      .order("tested_on", { ascending: false }),
    (admin as any)
      .from("items")
      .select("id, name, category")
      .eq("is_archived", false)
      .order("category")
      .order("name"),
    (admin as any)
      .from("plantings")
      .select("id, crop_name, variety, sow_date, item_id, status")
      .eq("planting_stock", "seeds")
      .in("status", ["planned", "planted", "growing"])
      .order("sow_date", { ascending: false })
      .limit(200),
  ]);

  const flower = flowerImageForName(seed.item?.name ?? seed.variety) ?? "calendula";
  const flowerSlug = flower.replace(/^.*\/flowers\//, "").replace(/\.png$/, "");

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Seed</h1>
      </header>
      <EditorialHero
        eyebrow={seed.item?.category ?? "Inventory"}
        title={seed.variety}
        subtitle={seed.item?.name ?? undefined}
        flower={flowerSlug}
        backHref="/admin/seeds"
      />

      <div className="px-4 py-4 max-w-2xl mx-auto">
        <SeedDetailClient
          seed={seed as SeedWithItem}
          sowings={(sowings ?? []) as SeedSowingWithPlanting[]}
          germTests={(germTests ?? []) as SeedGerminationTestRow[]}
          items={(itemsRaw ?? []) as { id: string; name: string; category: string }[]}
          plantings={(plantings ?? []) as {
            id: string;
            crop_name: string;
            variety: string | null;
            sow_date: string | null;
            item_id: string | null;
            status: string;
          }[]}
        />
      </div>
    </main>
  );
}
