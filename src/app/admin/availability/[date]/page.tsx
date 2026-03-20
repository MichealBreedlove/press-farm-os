/**
 * /admin/availability/[date] — Edit availability for a delivery date
 *
 * Per-restaurant tabs (Press / Understudy).
 * Item list with status toggle (available/limited/unavailable),
 * limited_qty input, cycle_notes input.
 * "Duplicate Last Cycle" and "Publish" buttons.
 *
 * TODO: Build availability editor UI
 */
export default async function AdminAvailabilityEditorPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 py-4">
        <h1 className="text-lg font-semibold">Availability — {date}</h1>
      </header>

      {/* TODO: Restaurant tabs (Press / Understudy) */}
      {/* TODO: AvailabilityEditor component */}
      {/* TODO: Duplicate Last Cycle button */}
      {/* TODO: Publish button */}

      <div className="px-4 py-6">
        <p className="text-center text-gray-400 text-sm">
          Availability editor for {date} — coming in Phase 1 build
        </p>
      </div>
    </main>
  );
}
