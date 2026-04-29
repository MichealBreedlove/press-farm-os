import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

/**
 * /admin/settings/data-check — Data completeness dashboard
 * Shows counts for all major tables to verify imports are complete.
 */
export default async function DataCheckPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Run all counts in parallel
  const [
    { count: itemCount },
    { count: archivedCount },
    { count: deliveryCount },
    { count: deliveryItemCount },
    { count: expenseCount },
    { count: orderCount },
    { count: orderItemCount },
    { count: availabilityCount },
    { count: deliveryDateCount },
    { count: laborCount },
    { count: noteCount },
    { count: profileCount },
    { count: restaurantCount },
    { data: deliveryRange },
    { data: expenseRange },
    { data: categories },
  ] = await Promise.all([
    (admin as any).from("items").select("*", { count: "exact", head: true }).eq("is_archived", false),
    (admin as any).from("items").select("*", { count: "exact", head: true }).eq("is_archived", true),
    (admin as any).from("deliveries").select("*", { count: "exact", head: true }),
    (admin as any).from("delivery_items").select("*", { count: "exact", head: true }),
    (admin as any).from("farm_expenses").select("*", { count: "exact", head: true }),
    (admin as any).from("orders").select("*", { count: "exact", head: true }),
    (admin as any).from("order_items").select("*", { count: "exact", head: true }),
    (admin as any).from("availability_items").select("*", { count: "exact", head: true }),
    (admin as any).from("delivery_dates").select("*", { count: "exact", head: true }),
    (admin as any).from("labor_entries").select("*", { count: "exact", head: true }),
    (admin as any).from("farm_notes").select("*", { count: "exact", head: true }),
    (admin as any).from("profiles").select("*", { count: "exact", head: true }),
    (admin as any).from("restaurants").select("*", { count: "exact", head: true }),
    (admin as any).from("deliveries").select("delivery_date").order("delivery_date", { ascending: true }).limit(1).single(),
    (admin as any).from("farm_expenses").select("date").order("date", { ascending: true }).limit(1).single(),
    (admin as any).from("items").select("category").then((r: any) => {
      const counts: Record<string, number> = {};
      for (const item of r.data ?? []) {
        counts[item.category] = (counts[item.category] ?? 0) + 1;
      }
      return { data: counts };
    }),
  ]);

  // Get latest delivery
  const { data: latestDelivery } = await (admin as any)
    .from("deliveries").select("delivery_date").order("delivery_date", { ascending: false }).limit(1).single();

  // Get total delivery value
  const { data: allDeliveries } = await (admin as any)
    .from("deliveries").select("total_value");
  const totalDeliveryValue = (allDeliveries ?? []).reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);

  // Get total expenses
  const { data: allExpenses } = await (admin as any)
    .from("farm_expenses").select("amount");
  const totalExpenseValue = (allExpenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);

  const rows: { label: string; value: string | number; target?: string; status?: "ok" | "warn" | "missing" }[] = [
    { label: "Active Items", value: itemCount ?? 0, target: "~289", status: (itemCount ?? 0) >= 280 ? "ok" : "warn" },
    { label: "Archived Items", value: archivedCount ?? 0 },
    { label: "Categories", value: Object.keys(categories ?? {}).length },
    { label: "Restaurants", value: restaurantCount ?? 0, target: "3", status: (restaurantCount ?? 0) >= 3 ? "ok" : "warn" },
    { label: "User Profiles", value: profileCount ?? 0 },
    { label: "Delivery Dates", value: deliveryDateCount ?? 0 },
    { label: "Deliveries Logged", value: deliveryCount ?? 0, target: "~351", status: (deliveryCount ?? 0) >= 340 ? "ok" : "warn" },
    { label: "Delivery Line Items", value: deliveryItemCount ?? 0, target: "~3199", status: (deliveryItemCount ?? 0) >= 3000 ? "ok" : "warn" },
    { label: "Total Delivery Value", value: formatCurrency(totalDeliveryValue) },
    { label: "First Delivery", value: deliveryRange?.delivery_date ?? "None" },
    { label: "Latest Delivery", value: latestDelivery?.delivery_date ?? "None" },
    { label: "Expenses", value: expenseCount ?? 0, target: "~109", status: (expenseCount ?? 0) >= 100 ? "ok" : "warn" },
    { label: "Total Expenses", value: formatCurrency(totalExpenseValue) },
    { label: "First Expense", value: expenseRange?.date ?? "None" },
    { label: "Orders", value: orderCount ?? 0 },
    { label: "Order Items", value: orderItemCount ?? 0 },
    { label: "Availability Items", value: availabilityCount ?? 0 },
    { label: "Labor Entries", value: laborCount ?? 0 },
    { label: "Notes", value: noteCount ?? 0 },
  ];

  const statusColor = { ok: "text-farm-green", warn: "text-pf-master-orange", missing: "text-red-500" };

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/settings" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">←</Link>
          <h1 className="page-title">Data Check</h1>
        </div>
        <p className="text-sm text-white/60">Verify imports are complete</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Items by category */}
        <div className="card p-4">
          <p className="section-eyebrow with-flower text-farm-muted mb-3">Items by Category</p>
          <div className="space-y-1">
            {Object.entries(categories ?? {}).sort(([, a]: any, [, b]: any) => b - a).map(([cat, count]: any) => (
              <div key={cat} className="flex justify-between text-sm">
                <span className="text-farm-muted/90">{cat}</span>
                <span className="font-medium text-farm-dark">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* All counts */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 bg-farm-cream/40 border-b border-farm-dark/5">
            <p className="section-eyebrow with-flower text-farm-muted">Database Counts</p>
          </div>
          {rows.map((row) => (
            <div key={row.label} className="px-4 py-2.5 flex items-center justify-between border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-farm-muted/90">{row.label}</span>
                {row.target && (
                  <span className="text-[10px] text-farm-muted">target: {row.target}</span>
                )}
              </div>
              <span className={`text-sm font-semibold ${row.status ? statusColor[row.status] : "text-farm-dark"}`}>
                {row.value}
                {row.status === "ok" && " ✓"}
                {row.status === "warn" && " ⚠"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

