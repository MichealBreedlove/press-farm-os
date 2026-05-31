/**
 * Farmer pay — effective-dated, prorated by day.
 *
 * Source of truth is the `farmer_pay_rates` table (migration 047). To stay safe
 * if that table is missing/empty (e.g. code deployed before the migration runs),
 * we fall back to DEFAULT_RATES, which encode exactly the same seeded rows. Either
 * way the math is identical.
 *
 * Two models per rate row (exactly one set):
 *   - hourly:  hourly_rate * hours_per_week -> weekly amount (prorated /7 per day)
 *   - flat:    flat_quarterly               -> per-quarter amount (prorated by day)
 *
 * A quarter's pay is summed day-by-day using whichever rate is in effect that day
 * (latest effective_date <= the day). This keeps full legacy quarters at exactly
 * $12,000 while prorating the partial quarter where the rate changes (2026-05-24).
 */

export type FarmerPayRate = {
  effective_date: string; // YYYY-MM-DD
  hourly_rate: number | null;
  hours_per_week: number | null;
  flat_quarterly: number | null;
};

// Mirrors the seed rows in migration 047. Used as a fallback only.
export const DEFAULT_RATES: FarmerPayRate[] = [
  {
    effective_date: "2020-01-01",
    hourly_rate: null,
    hours_per_week: null,
    flat_quarterly: 12000,
  },
  {
    effective_date: "2026-05-24",
    hourly_rate: 30,
    hours_per_week: 40,
    flat_quarterly: null,
  },
];

/** The rate in effect on a given YYYY-MM-DD (latest effective_date <= day). */
function rateForDay(
  rates: FarmerPayRate[],
  day: string
): FarmerPayRate | null {
  let chosen: FarmerPayRate | null = null;
  for (const r of rates) {
    if (r.effective_date <= day) {
      if (!chosen || r.effective_date > chosen.effective_date) chosen = r;
    }
  }
  return chosen;
}

/** Pay contribution for a single day under a given rate. */
function dailyPay(rate: FarmerPayRate, daysInQuarter: number): number {
  if (rate.hourly_rate != null && rate.hours_per_week != null) {
    return (rate.hourly_rate * rate.hours_per_week) / 7; // weekly -> daily
  }
  if (rate.flat_quarterly != null) {
    return rate.flat_quarterly / daysInQuarter;
  }
  return 0;
}

/**
 * Farmer pay for one calendar quarter, prorated across any mid-quarter rate
 * change. `year` is e.g. 2026, `quarter` is 1–4.
 */
export function farmerPayForQuarter(
  year: number,
  quarter: number,
  rates: FarmerPayRate[]
): number {
  const startMonth = (quarter - 1) * 3; // 0-indexed month
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 1)); // first day of next quarter
  const daysInQuarter = Math.round(
    (end.getTime() - start.getTime()) / 86_400_000
  );

  let total = 0;
  for (
    let d = new Date(start);
    d < end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const day = d.toISOString().slice(0, 10);
    const rate = rateForDay(rates, day);
    if (rate) total += dailyPay(rate, daysInQuarter);
  }
  return total;
}

/** Sum of farmer pay across a set of "YYYY-Q#" quarter keys. */
export function farmerPayForQuarters(
  quarterKeys: Iterable<string>,
  rates: FarmerPayRate[]
): number {
  let total = 0;
  for (const key of quarterKeys) {
    const [y, q] = key.split("-Q");
    total += farmerPayForQuarter(parseInt(y), parseInt(q), rates);
  }
  return total;
}

/**
 * Fetch rate rows from Supabase, falling back to DEFAULT_RATES on any error or
 * empty result. `admin` is a Supabase client (service role in the report pages).
 */
export async function loadFarmerPayRates(
  admin: any
): Promise<FarmerPayRate[]> {
  try {
    const { data, error } = await admin
      .from("farmer_pay_rates")
      .select("effective_date, hourly_rate, hours_per_week, flat_quarterly")
      .order("effective_date", { ascending: true });
    if (error || !data || data.length === 0) return DEFAULT_RATES;
    return data as FarmerPayRate[];
  } catch {
    return DEFAULT_RATES;
  }
}
