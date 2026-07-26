import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ExpensesClient } from "./ExpensesClient";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { todayPacific } from "@/lib/utils";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function AdminExpensesPage({ searchParams }: Props) {
  const { month: monthParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const currentMonth = monthParam ?? todayPacific().slice(0, 7);

  const [year, mon] = currentMonth.split("-").map(Number);
  const start = `${currentMonth}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;

  // Prev / next month links
  const prevDate = new Date(year, mon - 2, 1);
  const nextDate = new Date(year, mon, 1);
  const fmtMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const prevMonth = fmtMonth(prevDate);
  const nextMonth = fmtMonth(nextDate);
  const isCurrentMonth = currentMonth === todayPacific().slice(0, 7);

  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const admin = createAdminClient();

  const { data: expensesRaw } = await admin
    .from("farm_expenses")
    .select("id, date, category, description, amount, vendor")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  const expenses: { id: string; date: string; category: string; description: string | null; amount: number; vendor: string | null }[] =
    expensesRaw ?? [];

  // Aggregate by category
  const totalByCategory: Record<string, number> = {};
  let grandTotal = 0;
  for (const e of expenses) {
    totalByCategory[e.category] = (totalByCategory[e.category] ?? 0) + e.amount;
    grandTotal += e.amount;
  }

  return (
    <main className="pb-24">
      <header className="page-header no-wordmark">
        <h1 className="page-title">Expenses</h1>

        {/* Month navigation */}
        <div className="flex items-center justify-between mt-2">
          <Link
            href={`/admin/expenses?month=${prevMonth}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/70 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-white">{monthLabel}</span>
          <Link
            href={isCurrentMonth ? "#" : `/admin/expenses?month=${nextMonth}`}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
              isCurrentMonth ? "text-white/30" : "text-white/70 hover:text-white"
            }`}
            aria-disabled={isCurrentMonth}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </header>
      <EditorialHero
        eyebrow="Farm Management"
        title="Expenses"
        subtitle="Track operating costs · group by category"
        flower="chive-blossom"
        backHref="/admin/dashboard"
      />

      <div className="px-4 py-6">
        <div className="flex justify-end mb-3">
          <Link
            href="/admin/expenses/data"
            className="text-xs text-farm-green font-medium hover:underline inline-flex items-center gap-1 min-h-0"
            title="Bulk import / export"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m-8 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Import / Export
          </Link>
        </div>
        <ExpensesClient
          month={currentMonth}
          expenses={expenses}
          totalByCategory={totalByCategory}
          grandTotal={grandTotal}
        />
      </div>
    </main>
  );
}
