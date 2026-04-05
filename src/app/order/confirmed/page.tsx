import Link from "next/link";

export default function OrderConfirmedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-farm-cream px-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🌿</div>
        <h1 className="text-2xl font-semibold text-farm-green mb-2">Order Submitted!</h1>
        <p className="text-gray-500 mb-8">
          Your order has been sent to Press Farm. You&apos;ll receive a confirmation email shortly.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/order"
            className="bg-farm-green text-white text-base font-medium py-3 px-6 rounded-2xl block"
          >
            Back to Order
          </Link>
          <Link
            href="/history"
            className="text-farm-green text-sm font-medium py-2"
          >
            View Order History
          </Link>
        </div>
      </div>
    </main>
  );
}
