/**
 * /admin/reports — Financial dashboard
 *
 * MTD summary cards: Total Value, Total Expenses, Net Value, EOM Running Total.
 * Monthly breakdown by restaurant.
 * Charts: bar (monthly value), line (EOM running total).
 *
 * TODO: Build financial dashboard with Recharts
 */
export default function AdminReportsPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Reports</h1>
      </header>

      <div className="px-4 py-6">
        {/* TODO: Summary cards */}
        {/* TODO: Monthly value bar chart (Recharts) */}
        {/* TODO: EOM running total line chart */}
        {/* TODO: Links to income statement, expense report, most ordered items */}
        <p className="text-center text-gray-400 text-sm">
          Financial dashboard — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
