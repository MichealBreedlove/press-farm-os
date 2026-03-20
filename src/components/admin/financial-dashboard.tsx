"use client";

/**
 * FinancialDashboard — admin reports overview with Recharts.
 *
 * Summary cards: Total Value MTD, Total Expenses MTD, Net Value, EOM Running Total.
 * Charts:
 *   - Monthly delivery value (BarChart) — value by restaurant
 *   - EOM running total (LineChart)
 *   - Expense breakdown (PieChart by category)
 *   - Quarterly income (grouped BarChart)
 *
 * Benchmark: Q1 2026 = $21,633 production value / $1,536 expenses / $12K farmer pay
 *
 * TODO: Implement with Recharts in Phase 1
 */

interface FinancialDashboardProps {
  month: string; // "2026-02"
}

export function FinancialDashboard({ month }: FinancialDashboardProps) {
  void month;

  return (
    <div className="p-4">
      <p className="text-center text-gray-400 text-sm">
        FinancialDashboard — TODO: implement with Recharts in Phase 1
      </p>
    </div>
  );
}
