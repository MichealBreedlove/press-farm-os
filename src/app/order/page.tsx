/**
 * /order — Chef main ordering interface
 *
 * Shows availability for the chef's restaurant grouped by category.
 * Chef enters quantities and submits order.
 *
 * TODO: Build ordering UI with availability fetch + item rows
 */
export default function OrderPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Order for Thursday, Mar 19</h1>
        <p className="text-sm text-gray-500">Press Kitchen</p>
      </header>

      <div className="px-4 py-6">
        {/* TODO: CategorySection components with availability items */}
        <p className="text-center text-gray-400 text-sm">
          Order form — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
