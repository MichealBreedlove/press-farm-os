import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { Flower2 } from "lucide-react";
import { plantingAccrual, valueByMonth } from "@/lib/production-value/accrual";
import { todayPacific } from "@/lib/utils";

export const dynamic = "force-dynamic"; // production value is relative to today

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

export default async function PlanterBoxesPage() {
  const admin = createAdminClient();
  const today = todayPacific();

  const { data } = await (admin as any)
    .from("planter_boxes")
    .select("*, planter_box_plantings(*)")
    .order("name");
  const boxes = (data ?? []) as any[];

  const enriched = boxes.map((b) => {
    const plantings = b.planter_box_plantings ?? [];
    const total = plantings.reduce((s: number, p: any) => s + valueToDate(p, today), 0);
    return { ...b, plantingCount: plantings.length, total };
  });
  const grandTotal = enriched.reduce((s, b) => s + b.total, 0);

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Production"
        title="Planter Boxes"
        subtitle={`${boxes.length} boxes · ${money(grandTotal)} production value to date`}
        flower="nasturtium"
        backHref="/admin/dashboard"
      />
      <div className="px-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link href="/admin/planter-boxes/new" className="btn-primary inline-block">+ New box</Link>
          <Link href="/admin/reports/production-value" className="text-sm text-farm-green hover:underline">
            Production value report →
          </Link>
        </div>

        {enriched.length === 0 ? (
          <p className="text-sm text-farm-muted">
            No planter boxes yet. Add one to track flowers and herbs chefs harvest themselves.
          </p>
        ) : (
          <ul className="space-y-2">
            {enriched.map((b) => (
              <li key={b.id}>
                <Link href={`/admin/planter-boxes/${b.id}`}
                  className="flex items-center gap-3 p-3 rounded border border-farm-muted/20 hover:border-farm-green">
                  <Flower2 className="w-5 h-5 text-farm-green shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {b.name}
                      {!b.is_active && (
                        <span className="text-[10px] uppercase tracking-wide text-farm-muted border border-farm-muted/30 rounded px-1.5 py-0.5">inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-farm-muted">
                      {b.plantingCount} planting{b.plantingCount === 1 ? "" : "s"}
                      {b.location ? ` · ${b.location}` : ""}
                    </div>
                  </div>
                  <span className="badge-blue shrink-0">{money(b.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
