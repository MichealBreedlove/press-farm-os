import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { formatCurrency } from "@/lib/utils";

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
    admin.from("items").select("*", { count: "exact", head: true }).eq("is_archived", false),
    admin.from("items").select("*", { count: "exact", head: true }).eq("is_archived", true),
    admin.from("deliveries").select("*", { count: "exact", head: true }),
    admin.from("delivery_items").select("*", { count: "exact", head: true }),
    admin.from("farm_expenses").select("*", { count: "exact", head: true }),
    admin.from("orders").select("*", { count: "exact", head: true }),
    admin.from("order_items").select("*", { count: "exact", head: true }),
    admin.from("availability_items").select("*", { count: "exact", head: true }),
    admin.from("delivery_dates").select("*", { count: "exact", head: true }),
    admin.from("labor_entries").select("*", { count: "exact", head: true }),
    admin.from("farm_notes").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("restaurants").select("*", { count: "exact", head: true }),
    admin.from("deliveries").select("delivery_date").order("delivery_date", { ascending: true }).limit(1).single(),
    admin.from("farm_expenses").select("date").order("date", { ascending: true }).limit(1).single(),
    admin.from("items").select("category").then((r: any) => {
      const counts: Record<string, number> = {};
      for (const item of r.data ?? []) {
        counts[item.category] = (counts[item.category] ?? 0) + 1;
      }
      return { data: counts };
    }),
  ]);

  // Get latest delivery
  const { data: latestDelivery } = await admin
    .from("deliveries").select("delivery_date").order("delivery_date", { ascending: false }).limit(1).single();

  // Get total delivery value
  const { data: allDeliveries } = await admin
    .from("deliveries").select("total_value");
  const totalDeliveryValue = (allDeliveries ?? []).reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);

  // Get total expenses
  const { data: allExpenses } = await admin
    .from("farm_expenses").select("amount");
  const totalExpenseValue = (allExpenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);

  const rows: { label: string; value: string | number; target?: string; status?: "ok" | "warn" | "missing"; href?: string }[] = [
    { label: "Active Items", value: itemCount ?? 0, target: "~289", status: (itemCount ?? 0) >= 280 ? "ok" : "warn", href: "/admin/items" },
    { label: "Archived Items", value: archivedCount ?? 0, href: "/admin/items" },
    { label: "Categories", value: Object.keys(categories ?? {}).length, href: "/admin/items" },
    { label: "Restaurants", value: restaurantCount ?? 0, target: "3", status: (restaurantCount ?? 0) >= 3 ? "ok" : "warn", href: "/admin/settings/users" },
    { label: "User Profiles", value: profileCount ?? 0, href: "/admin/settings/users" },
    { label: "Delivery Dates", value: deliveryDateCount ?? 0, href: "/admin/availability" },
    { label: "Deliveries Logged", value: deliveryCount ?? 0, target: "~351", status: (deliveryCount ?? 0) >= 340 ? "ok" : "warn", href: "/admin/deliveries" },
    { label: "Delivery Line Items", value: deliveryItemCount ?? 0, target: "~3199", status: (deliveryItemCount ?? 0) >= 3000 ? "ok" : "warn", href: "/admin/deliveries" },
    { label: "Total Delivery Value", value: formatCurrency(totalDeliveryValue), href: "/admin/reports/executive" },
    { label: "First Delivery", value: deliveryRange?.delivery_date ?? "None", href: deliveryRange?.delivery_date ? `/admin/deliveries/${deliveryRange.delivery_date}` : undefined },
    { label: "Latest Delivery", value: latestDelivery?.delivery_date ?? "None", href: latestDelivery?.delivery_date ? `/admin/deliveries/${latestDelivery.delivery_date}` : undefined },
    { label: "Expenses", value: expenseCount ?? 0, target: "~109", status: (expenseCount ?? 0) >= 100 ? "ok" : "warn", href: "/admin/expenses" },
    { label: "Total Expenses", value: formatCurrency(totalExpenseValue), href: "/admin/expenses" },
    { label: "First Expense", value: expenseRange?.date ?? "None", href: expenseRange?.date ? `/admin/expenses?month=${expenseRange.date.slice(0, 7)}` : undefined },
    { label: "Orders", value: orderCount ?? 0, href: "/admin/orders?view=explore&period=this_year" },
    { label: "Order Items", value: orderItemCount ?? 0, href: "/admin/orders?view=explore&period=this_year" },
    { label: "Availability Items", value: availabilityCount ?? 0, href: "/admin/availability" },
    { label: "Labor Entries", value: laborCount ?? 0, href: "/admin/labor" },
    { label: "Notes", value: noteCount ?? 0, href: "/admin/notes" },
  ];

  const statusColor = { ok: "text-farm-green", warn: "text-pf-master-orange", missing: "text-red-500" };

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Data Check</h1>
        </div>
        <p className="text-sm text-white/60">Verify imports are complete</p>
      </header>
      <EditorialHero
        eyebrow="Configuration"
        title="Data Check"
        subtitle="Integrity checks across the database"
        flower="alyssum"
        backHref="/admin/settings"
      />

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
          {rows.map((row) => {
            const inner = (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-farm-muted/90">{row.label}</span>
                  {row.target && (
                    <span className="text-[10px] text-farm-muted">target: {row.target}</span>
                  )}
                </div>
                <span className={`text-sm font-semibold flex items-center gap-1.5 ${row.status ? statusColor[row.status] : "text-farm-dark"}`}>
                  {row.value}
                  {row.status === "ok" && " ✓"}
                  {row.status === "warn" && " ⚠"}
                  {row.href && <span className="text-farm-muted/50 font-normal">›</span>}
                </span>
              </>
            );
            const cls = "px-4 py-2.5 min-h-[44px] flex items-center justify-between border-b border-gray-50 last:border-0";
            return row.href ? (
              <Link key={row.label} href={row.href} className={`${cls} hover:bg-farm-cream/40 transition-colors`}>
                {inner}
              </Link>
            ) : (
              <div key={row.label} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

