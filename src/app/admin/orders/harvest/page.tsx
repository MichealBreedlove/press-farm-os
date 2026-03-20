/**
 * /admin/orders/harvest — Combined harvest list
 *
 * Merges both Press + Understudy orders for the current delivery date.
 * Shows: Item, Unit, Press Qty, Understudy Qty, Total.
 * Grouped by category.
 *
 * TODO: Build harvest list (mobile-readable + printable)
 */
export default function HarvestListPage() {
  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Harvest List</h1>
        <p className="text-sm text-gray-500">Thursday, Mar 19</p>
      </header>

      <div className="px-4 py-6">
        {/* TODO: HarvestList component */}
        <p className="text-center text-gray-400 text-sm">
          Harvest list — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
