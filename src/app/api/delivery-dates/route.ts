import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Thu=4, Sat=6, Mon=1
const DAY_PATTERN = [4, 6, 1] as const;
const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
// Maps JS getUTCDay() (0=Sun) → day_of_week name
const DAY_OF_WEEK: Record<number, string> = {
  1: "monday",
  4: "thursday",
  6: "saturday",
};

function generateDatesAfter(
  afterDate: string,
  count: number
): Array<{ date: string; day_of_week: string; ordering_open: boolean }> {
  const results: Array<{ date: string; day_of_week: string; ordering_open: boolean }> = [];
  // Start the day after the last existing date
  const current = new Date(afterDate + "T00:00:00Z");
  current.setUTCDate(current.getUTCDate() + 1);

  while (results.length < count) {
    const dow = current.getUTCDay();
    if (DAY_PATTERN.includes(dow as 1 | 4 | 6)) {
      results.push({
        date: current.toISOString().slice(0, 10),
        day_of_week: DAY_OF_WEEK[dow],
        ordering_open: true,
      });
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return results;
}

/**
 * POST /api/delivery-dates
 * Generates the next N delivery dates after the latest existing one.
 * Body: { count?: number } — defaults to 4
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let count = 4;
  try {
    const body = await request.json();
    if (typeof body.count === "number" && body.count > 0 && body.count <= 52) {
      count = body.count;
    }
  } catch {
    // no body or invalid JSON — use default
  }

  const admin = createAdminClient();

  // Get the latest existing delivery date
  const { data: latest } = await (admin as any)
    .from("delivery_dates")
    .select("date")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const afterDate = (latest as any)?.date ?? new Date().toISOString().slice(0, 10);
  const toInsert = generateDatesAfter(afterDate, count);

  const { data: inserted, error } = await (admin as any)
    .from("delivery_dates")
    .insert(toInsert)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: inserted ?? [], count: (inserted ?? []).length });
}
