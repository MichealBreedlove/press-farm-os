import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ExpensesClient } from "./ExpensesClient";

interface Props {
  searchParams: Promise<{ month?: string }>;
}

export default async function AdminExpensesPage({ searchParams }: Props) {
  const { month: monthParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date();
  const currentMonth = monthParam ?? today.toISOString().slice(0, 7);

  const [year, mon] = currentMonth.split("-").map(Number);
  const start = `${currentMonth}-01`;
  const lastDay = new Date(year, mon, 0).getDate();
  const end = `${currentMonth}-${String(lastDay).padStart(2, "0")}`;

  // Prev / next month links
  const prevDate = new Date(year, mon - 2, 1);
  const nextDate = new Date(year, mon, 1);
  const prevMonth = prevDate.toISOString().slice(0, 7);
  const nextMonth = nextDate.toISOString().slice(0, 7);
  const isCurrentMonth = currentMonth === today.toISOString().slice(0, 7);

  const monthLabel = new Date(year, mon - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const admin = createAdminClient();

  const { data: expensesRaw } = await (admin as any)
    .from("farm_expenses")
    .select("id, date, category, description, amount")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  const expenses: { id: string; date: string; category: string; description: string | null; amount: number }[] =
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
      <header className="page-header">
        <h1 className="page-title">Expenses</h1>

        {/* Month navigation */}
        <div className="flex items-center justify-between mt-2">
          <Link
            href={`/admin/expenses?month=${prevMonth}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-500 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="text-sm font-medium text-gray-900">{monthLabel}</span>
          <Link
            href={isCurrentMonth ? "#" : `/admin/expenses?month=${nextMonth}`}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors ${
              isCurrentMonth ? "text-gray-200" : "text-gray-500 hover:text-gray-900"
            }`}
            aria-disabled={isCurrentMonth}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </header>

      <div className="px-4 py-6">
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
