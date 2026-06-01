import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/labor — List labor entries (admin only)
 */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("labor_entries")
    .select("*")
    .order("date", { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/**
 * POST /api/labor — Create labor entry (admin only)
 *
 * Body accepts EITHER:
 *   • { worker_name, date, time_in, lunch_out?, lunch_in?, time_out, hourly_rate?, notes?, farm_id }
 *     — preferred. Hours is computed from the times on the server.
 *   • { worker_name, date, hours, hourly_rate?, notes?, farm_id }
 *     — legacy direct-hours entry. Still accepted for back-compat.
 *
 * The four time fields are TIME of day strings ("HH:MM" or "HH:MM:SS").
 * lunch_out + lunch_in are optional but must be provided as a pair.
 * Hours = (time_out - time_in) - (lunch_in - lunch_out), all in minutes.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const {
    worker_name, date, hourly_rate, notes, farm_id,
    time_in, lunch_out, lunch_in, time_out,
  } = body;
  let { hours } = body;

  if (!worker_name || !date) {
    return NextResponse.json({ error: "worker_name and date are required" }, { status: 400 });
  }

  // Validate / coerce time pair: either both or neither
  if ((lunch_out && !lunch_in) || (!lunch_out && lunch_in)) {
    return NextResponse.json(
      { error: "lunch_out and lunch_in must be provided together (or both omitted)" },
      { status: 400 },
    );
  }

  // If clock times provided, compute hours server-side. Wins over any
  // hours value the client sent — server is source of truth for math.
  if (time_in && time_out) {
    const tIn = parseTimeToMinutes(time_in);
    const tOut = parseTimeToMinutes(time_out);
    if (tIn == null || tOut == null) {
      return NextResponse.json({ error: "Invalid time_in or time_out (HH:MM)" }, { status: 400 });
    }
    if (tOut <= tIn) {
      return NextResponse.json({ error: "time_out must be after time_in" }, { status: 400 });
    }
    let lunchMinutes = 0;
    if (lunch_out && lunch_in) {
      const lOut = parseTimeToMinutes(lunch_out);
      const lIn = parseTimeToMinutes(lunch_in);
      if (lOut == null || lIn == null) {
        return NextResponse.json({ error: "Invalid lunch_out or lunch_in (HH:MM)" }, { status: 400 });
      }
      if (lIn <= lOut) {
        return NextResponse.json({ error: "lunch_in must be after lunch_out" }, { status: 400 });
      }
      if (lOut < tIn || lIn > tOut) {
        return NextResponse.json({ error: "Lunch must fall within the shift" }, { status: 400 });
      }
      lunchMinutes = lIn - lOut;
    }
    hours = Math.round(((tOut - tIn - lunchMinutes) / 60) * 100) / 100;
  }

  if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) {
    return NextResponse.json(
      { error: "hours required (or provide time_in + time_out so we can compute it)" },
      { status: 400 },
    );
  }
  if (hours > 24) {
    return NextResponse.json({ error: "Hours can't exceed 24 in a single entry" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("labor_entries")
    .insert({
      farm_id,
      worker_name,
      date,
      hours,
      hourly_rate: hourly_rate || null,
      notes: notes || null,
      time_in: time_in || null,
      lunch_out: lunch_out || null,
      lunch_in: lunch_in || null,
      time_out: time_out || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

/**
 * Parse "HH:MM" or "HH:MM:SS" → minutes since midnight. Returns null on
 * malformed input so the caller can return a 400 with a clear message.
 */
function parseTimeToMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}
