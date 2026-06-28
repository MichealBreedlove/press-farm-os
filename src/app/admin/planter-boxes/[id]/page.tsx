import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { BoxDetailClient, type EnrichedPlanting } from "@/components/admin/planter-boxes/BoxDetailClient";
import { plantingAccrual, valueByMonth } from "@/lib/production-value/accrual";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function valueToDate(p: any, today: string): number {
  const acc = plantingAccrual({
    lifecycle: p.lifecycle,
    valueAmount: Number(p.value_amount),
    plantedDate: p.planted_date,
    endDate: p.end_date,
    seasonalMonths: p.seasonal_months,
    today,
  });
  if (!acc) return 0;
  return Object.values(valueByMonth(acc, today)).reduce((s, v) => s + v, 0);
}

export default async function PlanterBoxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: box }, { data: items }] = await Promise.all([
    (admin as any)
      .from("planter_boxes")
      .select("*, planter_box_plantings(*), planter_box_activity(*)")
      .eq("id", id)
      .single(),
    admin.from("items").select("id, name").order("name"),
  ]);
  if (!box) notFound();

  const plantings: EnrichedPlanting[] = (box.planter_box_plantings ?? [])
    .map((p: any) => ({ ...p, value_to_date: valueToDate(p, today) }))
    .sort((a: any, b: any) => (a.planted_date < b.planted_date ? 1 : -1));

  const activity = (box.planter_box_activity ?? []).sort((a: any, b: any) =>
    a.logged_at < b.logged_at ? 1 : -1,
  );

  const total = plantings.reduce((s, p) => s + p.value_to_date, 0);

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Planter Box"
        title={box.name}
        subtitle={`${money(total)} production value to date${box.location ? ` · ${box.location}` : ""}`}
        flower="nasturtium"
        backHref="/admin/planter-boxes"
      />
      <div className="px-4 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/admin/planter-boxes/${id}/edit`} className="text-farm-green hover:underline">Edit box</Link>
          {box.size && <span className="text-farm-muted">· {box.size}</span>}
          {box.notes && <span className="text-farm-muted">· {box.notes}</span>}
        </div>
        <BoxDetailClient boxId={id} items={items ?? []} plantings={plantings} activity={activity} />
      </div>
    </main>
  );
}
