/**
 * /history/[orderId] — Chef order detail view
 *
 * Shows all items, quantities requested vs. fulfilled, shortage reasons.
 *
 * TODO: Fetch and display order detail
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Order Detail</h1>
        <p className="text-xs text-gray-400 font-mono">{orderId}</p>
      </header>

      <div className="px-4 py-6">
        {/* TODO: Order detail component */}
        <p className="text-center text-gray-400 text-sm">
          Order detail — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
