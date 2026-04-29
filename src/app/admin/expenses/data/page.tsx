import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { ExpensesDataClient } from "./ExpensesDataClient";

export default async function ExpensesDataPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const [{ count: totalCount }, { data: dateRange }] = await Promise.all([
    (admin as any).from("farm_expenses").select("*", { count: "exact", head: true }),
    (admin as any).from("farm_expenses").select("date").order("date", { ascending: false }).limit(1),
  ]);

  // Sum total amount (small dataset; fine to fetch and reduce)
  const { data: amounts } = await (admin as any).from("farm_expenses").select("amount");
  const totalAmount = ((amounts ?? []) as Array<{ amount: number | string }>).reduce(
    (sum, r) => sum + (typeof r.amount === "number" ? r.amount : parseFloat(String(r.amount)) || 0),
    0,
  );

  const latestDate = (dateRange as Array<{ date: string }> | null)?.[0]?.date ?? null;

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/expenses" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Expenses · Data</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Farm Management"
        title="Import & Export"
        subtitle="Round-trip your expense ledger through Excel."
        flower="rosemary"
        backHref="/admin/expenses"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        <ExpensesDataClient
          totalCount={totalCount ?? 0}
          totalAmount={totalAmount}
          latestDate={latestDate}
        />
      </div>
    </main>
  );
}
