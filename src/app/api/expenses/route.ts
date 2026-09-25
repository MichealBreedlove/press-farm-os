import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidMonth, normalizeExpenseCategory } from "@/lib/expenses";

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
    .select("id, date, category, description, amount, vendor, created_at")
    .order("date", { ascending: false });

  if (month) {
    if (!isValidMonth(month)) {
      return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
    }
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
 * `category` may be several comma-joined categories ("Seeds, Soil").
 * Admin only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: { date: string; category: string; description?: string | null; vendor?: string | null; amount: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, description, vendor, amount } = body;
  const category = normalizeExpenseCategory(body.category);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
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
    .insert({
      farm_id: farm.id,
      date,
      category,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      vendor: typeof vendor === "string" && vendor.trim() ? vendor.trim() : null,
      amount,
    })
    .select("id, date, category, description, amount, vendor")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ expense }, { status: 201 });
}
