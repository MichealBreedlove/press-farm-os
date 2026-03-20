/**
 * /admin/deliveries/finalize — EOM finalization
 *
 * Shows all logged deliveries for the current month with running total.
 * "Finalize Month" locks all deliveries and feeds into financial_periods.
 *
 * TODO: Build EOM finalization UI
 */
export default function AdminFinalizeMonthPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Finalize Month</h1>
      </header>

      <div className="px-4 py-6">
        {/* TODO: Month summary + delivery list */}
        {/* TODO: "Finalize" button with confirmation */}
        <p className="text-center text-gray-400 text-sm">
          EOM finalization — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
