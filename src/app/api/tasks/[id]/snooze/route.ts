import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/tasks/auth";
import { addDays, todayIso } from "@/lib/tasks/dates";

interface RouteCtx {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/snooze
 *
 * Body: { days?: number, until_date?: string }
 * Either bumps the due_date by N days from today, or sets it to a specific
 * future date. Status stays 'open' (snooze = move forward, not hide).
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.res;
  const { id } = await ctx.params;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // empty body ok
  }

  let newDate: string | null = null;
  if (typeof body.until_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.until_date)) {
    newDate = body.until_date;
  } else if (typeof body.days === "number" && body.days > 0 && body.days <= 365) {
    newDate = addDays(todayIso(), body.days);
  }

  if (!newDate) {
    return NextResponse.json(
      { error: "Provide either { days: number } or { until_date: 'YYYY-MM-DD' }" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("farm_tasks")
    .update({ due_date: newDate, snoozed_until: newDate })
    .eq("farm_id", auth.farmId)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Snooze failed" }, { status: 500 });
  }
  return NextResponse.json({ task: data });
}
