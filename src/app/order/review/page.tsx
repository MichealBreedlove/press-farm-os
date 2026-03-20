/**
 * /order/review — Order review before submit
 *
 * Shows summary of all ordered items + freeform notes.
 * Chef can go back to edit or submit.
 *
 * TODO: Build review UI
 */
export default function OrderReviewPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold">Review Order</h1>
      </header>

      <div className="px-4 py-6">
        {/* TODO: OrderSummary component */}
        <p className="text-center text-gray-400 text-sm">
          Order review — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
