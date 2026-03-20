/**
 * /admin/orders — Orders dashboard
 *
 * Shows orders for today's delivery date (and upcoming).
 * Per-restaurant order cards. Quick access to harvest list.
 * Admin can close ordering from here.
 *
 * TODO: Build orders dashboard UI
 */
export default function AdminOrdersPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Orders</h1>
        <p className="text-sm text-gray-500">Thursday, Mar 19</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* TODO: OrderCard for Press */}
        {/* TODO: OrderCard for Understudy */}
        {/* TODO: "View Harvest List" button */}
        {/* TODO: "Close Ordering" button */}
        <p className="text-center text-gray-400 text-sm">
          Orders dashboard — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
