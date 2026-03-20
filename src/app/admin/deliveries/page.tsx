/**
 * /admin/deliveries — Delivery log dashboard
 *
 * Shows delivery history grouped by date.
 * EOM running total.
 * "Finalize Month" action.
 *
 * TODO: Build delivery log dashboard
 */
export default function AdminDeliveriesPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Deliveries</h1>
      </header>

      <div className="px-4 py-6">
        {/* TODO: EOM running total card */}
        {/* TODO: Delivery list by date */}
        {/* TODO: "Finalize Month" button */}
        <p className="text-center text-gray-400 text-sm">
          Delivery log — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
