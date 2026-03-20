/**
 * /admin/orders/[date] — Orders for a specific delivery date
 *
 * Shows Press + Understudy orders for the given date.
 * Admin can mark shortages, fulfill, and close ordering.
 *
 * TODO: Fetch and display orders for the date
 */
export default async function AdminOrdersByDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Orders — {date}</h1>
      </header>

      <div className="px-4 py-6">
        {/* TODO: Orders detail for this date */}
        <p className="text-center text-gray-400 text-sm">
          Orders for {date} — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
