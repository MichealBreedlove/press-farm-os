import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateExpenseInput } from "@/lib/expenses/validate";

const EXPENSE_COLUMNS = "id, date, category, description, vendor, amount, created_at";

/**
 * GET /api/expenses?month=2026-04
 * Lists farm expenses for a month. Admin only.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // "2026-04"

  const admin = createAdminClient();
  let query = admin
    .from("farm_expenses")
    .select(EXPENSE_COLUMNS)
    .order("date", { ascending: false });

  if (month) {
    const [year, mon] = month.split("-").map(Number);
    const start = `${month}-01`;
    const lastDay = new Date(year, mon, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;
    query = query.gte("date", start).lte("date", end);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expenses: data });
}

/**
 * POST /api/expenses
 * Body: { date, category, description?, vendor?, amount }
 * `category` may be a single name or a ", "-joined list of names.
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validateExpenseInput(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get farm_id (single-farm app)
  const { data: farm } = await admin
    .from("farms")
    .select("id")
    .single();

  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  const { data: expense, error } = await admin
    .from("farm_expenses")
    .insert({ farm_id: farm.id, ...validated.value })
    .select(EXPENSE_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expense }, { status: 201 });
}
