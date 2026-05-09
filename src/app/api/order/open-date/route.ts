import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/order/open-date
 *
 * Lets a chef (or admin) open an off-schedule date for ordering by
 * idempotently creating a delivery_dates row with day_of_week='custom'
 * and ordering_open=true. The 'custom' enum value is the marker that
 * lets the admin dashboard flag the resulting orders as off-schedule.
 *
 * Body: { date: "YYYY-MM-DD" }
 * Returns: { ok: true, created: boolean, date }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Allow chef + admin roles. Receivers don't need this; events team
  // accounts use chef role (per Ask 1 plan).
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "chef" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const date = (body.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date required (YYYY-MM-DD)" }, { status: 400 });
  }

  // Future-only — no back-dating off-schedule orders.
  const today = new Date().toISOString().split("T")[0];
  if (date < today) {
    return NextResponse.json({ error: "Date must be today or later" }, { status: 400 });
  }

  const admin = createAdminClient();

  // If a row already exists for this date, just open it (don't override
  // an explicit Thursday → 'thursday' day_of_week with 'custom').
  const { data: existing } = await (admin as any)
    .from("delivery_dates")
    .select("id, day_of_week, ordering_open")
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    if (!existing.ordering_open) {
      const { error } = await (admin as any)
        .from("delivery_dates")
        .update({ ordering_open: true })
        .eq("id", existing.id);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true, created: false, date, day_of_week: existing.day_of_week });
  }

  // Compute the actual day-of-week — if it falls on Thu/Sat/Mon, use
  // those proper enums. Anything else is 'custom' and triggers the
  // admin dashboard's off-schedule warning.
  const dow = new Date(date + "T12:00:00").getDay(); // 0=Sun..6=Sat
  const dowMap: Record<number, "thursday" | "saturday" | "monday" | "custom"> = {
    1: "monday",
    4: "thursday",
    6: "saturday",
  };
  const day_of_week = dowMap[dow] ?? "custom";

  const { error: insertErr } = await (admin as any)
    .from("delivery_dates")
    .insert({ date, day_of_week, ordering_open: true });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: true, date, day_of_week });
}
