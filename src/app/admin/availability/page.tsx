import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default async function AdminAvailabilityPage() {
  const supabase = await createClient();

  // Get upcoming delivery dates (next 30 days)
  const today = new Date().toISOString().split("T")[0];
  const { data: deliveryDates } = await supabase
    .from("delivery_dates")
    .select("*")
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(12);

  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Availability</h1>
          <Link
            href="/admin/availability/new"
            className="bg-farm-green text-white text-sm px-4 py-2 rounded-full font-medium"
          >
            + Date
          </Link>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {!deliveryDates?.length && (
          <div className="text-center text-gray-400 text-sm py-12">
            <p className="text-3xl mb-3">📅</p>
            <p>No upcoming delivery dates.</p>
            <p className="mt-1">Tap &ldquo;+ Date&rdquo; to add one.</p>
          </div>
        )}
        {deliveryDates?.map((dd) => (
          <Link
            key={dd.id}
            href={`/admin/availability/${dd.date}`}
            className="block bg-white rounded-2xl border border-gray-100 px-4 py-4 active:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900 capitalize">
                  {dd.day_of_week} · {formatDate(dd.date)}
                </p>
                <p className={`text-xs mt-0.5 font-medium ${dd.ordering_open ? "text-green-600" : "text-gray-400"}`}>
                  {dd.ordering_open ? "Ordering open" : "Ordering closed"}
                </p>
              </div>
              <span className="text-gray-300 text-xl">›</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
