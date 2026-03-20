/**
 * /admin/reports/expenses — Expense tracking
 *
 * Add/view farm expenses. Running monthly total.
 * Categories: Seeds, Soil, Equipment, Gas, Supplies, etc.
 *
 * TODO: Build expense tracking UI
 */
export default function AdminExpensesPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Farm Expenses</h1>
        {/* TODO: "Add Expense" button */}
      </header>

      <div className="px-4 py-6">
        {/* TODO: Expense list with category filter */}
        {/* TODO: Monthly total card */}
        <p className="text-center text-gray-400 text-sm">
          Expense tracking — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
