import { NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/v1/expenses — List expenses
 * Query: ?month=2026-03&category=Seeds&limit=100
 */
export async function GET(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const url = new URL(request.url);
  const month = url.searchParams.get("month");
  const category = url.searchParams.get("category");

  const admin = createAdminClient();
  let query = (admin as any).from("farm_expenses").select("*").order("date", { ascending: false });

  if (month) {
    query = query.gte("date", `${month}-01`);
    const [y, m] = month.split("-").map(Number);
    query = query.lte("date", `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`);
  }
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count: data?.length ?? 0 });
}

/**
 * POST /api/v1/expenses — Create an expense
 */
export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const body = await request.json();

  const date = typeof body.date === "string" ? body.date.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "amount must be a non-negative finite number" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);

  const { data, error } = await (admin as any).from("farm_expenses").insert({
    farm_id: farms?.[0]?.id,
    date,
    category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : "Other",
    description: typeof body.description === "string" ? body.description : null,
    amount,
    vendor: typeof body.vendor === "string" ? body.vendor : null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * DELETE /api/v1/expenses — Delete an expense
 */
export async function DELETE(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  const { id } = await request.json();
  const admin = createAdminClient();
  const { error } = await (admin as any).from("farm_expenses").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
