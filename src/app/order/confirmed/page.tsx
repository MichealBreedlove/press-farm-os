/**
 * /order/confirmed — Post-submit success screen
 *
 * Shown after chef successfully submits an order.
 *
 * TODO: Build confirmation UI
 */
export default function OrderConfirmedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-2xl font-semibold text-farm-green mb-2">Order Submitted</h1>
        <p className="text-gray-500">
          You&apos;ll receive a confirmation email shortly.
        </p>
      </div>
    </main>
  );
}
