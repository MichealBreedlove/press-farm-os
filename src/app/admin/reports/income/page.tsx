/**
 * /admin/reports/income — Quarterly income statement
 *
 * Production value vs. expenses vs. farmer pay.
 * Q1 2026 benchmark: $21,633 value / $1,536 expenses / $12K farmer pay.
 *
 * TODO: Build quarterly income statement view
 */
export default function AdminIncomeStatementPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Income Statement</h1>
      </header>

      <div className="px-4 py-6">
        {/* TODO: Quarter selector */}
        {/* TODO: IncomeStatement component */}
        <p className="text-center text-gray-400 text-sm">
          Income statement — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
