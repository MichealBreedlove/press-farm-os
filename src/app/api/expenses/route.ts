import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET  /api/expenses — List farm expenses (filterable by month/category)
 * POST /api/expenses — Add a farm expense
 *
 * Admin only.
 *
 * TODO: Implement expense CRUD
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // "2026-02"
  const category = searchParams.get("category");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Fetch farm_expenses with filters
  void month;
  void category;
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Insert farm_expense
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
