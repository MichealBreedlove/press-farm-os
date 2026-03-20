/**
 * /admin/deliveries/[date] — Log or view a delivery for a specific date
 *
 * Pre-populates from fulfilled order if available.
 * Admin enters: item, qty, unit, unit_price per line.
 * Auto-calculates line_total and delivery total.
 * "Save Delivery" button.
 *
 * TODO: Build delivery log form
 */
export default async function AdminDeliveryLogPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Log Delivery — {date}</h1>
      </header>

      <div className="px-4 py-6">
        {/* TODO: Restaurant selector (Press / Understudy) */}
        {/* TODO: DeliveryLogForm component */}
        <p className="text-center text-gray-400 text-sm">
          Delivery log form for {date} — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
