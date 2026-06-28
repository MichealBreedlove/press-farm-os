import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { getProductionValue } from "@/lib/production-value/server";

export const dynamic = "force-dynamic";

const money = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export default async function ProductionValueReportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const data = await getProductionValue();

  // Months present across any source, newest first, capped to the last 18.
  const months = Object.keys(data.byMonth).sort().reverse().slice(0, 18);

  return (
    <main className="pb-24 bg-farm-cream min-h-screen">
      <EditorialHero
        eyebrow="Reports & Analytics"
        title="Production Value"
        subtitle="Self-harvest value · separate from chef order revenue"
        flower="nasturtium"
        backHref="/admin/reports"
      />

      <div className="px-4 max-w-3xl mx-auto space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card label="Total to date" value={money(data.total)} dark />
          <Card label="Microgreens" value={money(data.microTotal)} />
          <Card label="Planter boxes" value={money(data.boxTotal)} />
          <Card label="Press / Under-Study" value={`${money(data.byRestaurant.press)} / ${money(data.byRestaurant.understudy)}`} small />
        </div>

        <p className="text-xs text-farm-muted">
          Split {Math.round(data.split.press * 100)}% Press / {Math.round(data.split.understudy * 100)}% Under-Study.
          This value is tracked separately and never written to deliveries, so chef order
          and delivery reports are unaffected.
        </p>

        {/* Monthly trend */}
        <section className="bg-white border border-farm-dark/5 rounded-lg overflow-hidden">
          <div className="px-3 py-2 bg-farm-cream/40 border-b border-farm-dark/5 font-semibold text-sm">
            Monthly accrual
          </div>
          {months.length === 0 ? (
            <p className="p-4 text-sm text-farm-muted">
              No production value yet. Set a value per tray on a microgreen crop, or add
              planter-box plantings with a value, and it will accrue here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-farm-muted text-xs">
                    <th className="text-left px-3 py-1.5 font-medium">Month</th>
                    <th className="text-right px-3 py-1.5 font-medium">Microgreens</th>
                    <th className="text-right px-3 py-1.5 font-medium">Boxes</th>
                    <th className="text-right px-3 py-1.5 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m} className="border-t border-gray-50">
                      <td className="px-3 py-1.5">{monthLabel(m)}</td>
                      <td className="px-3 py-1.5 text-right text-farm-muted">{money(data.microByMonth[m] ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right text-farm-muted">{money(data.boxByMonth[m] ?? 0)}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-farm-dark">{money(data.byMonth[m] ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Per-source breakdown */}
        {(["Microgreens", "Planter Boxes"] as const).map((src) => {
          const rows = data.items.filter((i) => i.source === src);
          if (rows.length === 0) return null;
          return (
            <section key={src} className="bg-white border border-farm-dark/5 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-farm-cream/40 border-b border-farm-dark/5 font-semibold text-sm flex justify-between">
                <span>{src}</span>
                <span className="text-farm-muted">{money(rows.reduce((s, r) => s + r.total, 0))}</span>
              </div>
              <ul>
                {rows.map((r, i) => (
                  <li key={`${r.name}-${i}`} className="flex justify-between px-3 py-1.5 border-t border-gray-50 text-sm">
                    <span className="text-farm-dark">
                      {r.name}
                      {r.detail && r.detail !== "tray" && <span className="text-farm-muted"> · {r.detail}</span>}
                    </span>
                    <span className="font-medium">{money(r.total)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Card({ label, value, dark, small }: { label: string; value: string; dark?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 ${dark ? "bg-[#212326] text-white" : "bg-white border border-farm-dark/5"}`}>
      <p className={`text-[9px] uppercase tracking-wider ${dark ? "text-farm-muted" : "text-farm-muted"}`}>{label}</p>
      <p className={`${small ? "text-xs" : "text-lg"} font-bold leading-tight mt-0.5 ${dark ? "text-[#F0B530]" : "text-farm-dark"}`}>{value}</p>
    </div>
  );
}
