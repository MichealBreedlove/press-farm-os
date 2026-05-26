import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ForecastClient } from "./ForecastClient";
import {
  fetchHistoricalDeliveries,
  fetchSeasonalItems,
  getCalendarEvents,
  historicalWeeks,
} from "@/lib/forecasting";

export const dynamic = "force-dynamic";

/**
 * /order/forecast — Chef-facing year-scope read-only availability forecast.
 *
 * Three data zones unioned in the UI: past delivery actuals (per restaurant),
 * current concrete plantings (from forecasting lib), and far-future seasonal
 * hints (from items.seasonal_months).
 */
export default async function ForecastPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: restaurantUser } = (await supabase
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name)")
    .eq("user_id", user.id)
    .single()) as any;

  if (!restaurantUser?.restaurants) {
    return (
      <main className="min-h-screen bg-farm-cream flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 text-sm">
            No restaurant found for your account. Please contact Press Farm.
          </p>
        </div>
      </main>
    );
  }

  const restaurant = restaurantUser.restaurants;

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1;

  // ±52 weeks from today
  const MS_PER_DAY = 86_400_000;
  const fromIso = new Date(today.getTime() - 52 * 7 * MS_PER_DAY).toISOString().slice(0, 10);
  const toIso = new Date(today.getTime() + 52 * 7 * MS_PER_DAY).toISOString().slice(0, 10);

  // Fetch the three zones in parallel.
  const [pastRows, concreteEvents, seasonalItems] = await Promise.all([
    fetchHistoricalDeliveries(fromIso, todayIso, restaurant.id),
    getCalendarEvents(todayIso, toIso),
    fetchSeasonalItems(),
  ]);

  const past = historicalWeeks(fromIso, todayIso, pastRows);

  return (
    <main className="min-h-screen bg-farm-cream">
      <header className="page-header">
        <h1 className="page-title">Forecast</h1>
        <p className="text-base sm:text-sm font-semibold sm:font-medium text-white/90">
          {restaurant.name}
        </p>
      </header>

      <ForecastClient
        initialYear={currentYear}
        currentYear={currentYear}
        currentMonth={currentMonth}
        yearOptions={[currentYear - 1, currentYear, currentYear + 1]}
        data={{ past, concrete: concreteEvents, seasonal: seasonalItems }}
      />
    </main>
  );
}
