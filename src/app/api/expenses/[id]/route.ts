import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeExpenseCategory } from "@/lib/expenses";

/**
 * PATCH /api/expenses/[id] — Update expense (admin only)
 * Body: any of { date, category, description, vendor, amount }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: {
    date?: string;
    category?: string;
    description?: string | null;
    vendor?: string | null;
    amount?: number;
  } = {};

  if ("date" in body) {
    if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    }
    patch.date = body.date;
  }
  if ("category" in body) {
    const category = normalizeExpenseCategory(body.category);
    if (!category) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    patch.category = category;
  }
  if ("amount" in body) {
    const amount = body.amount;
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }
    patch.amount = amount;
  }
  if ("description" in body) {
    patch.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  }
  if ("vendor" in body) {
    patch.vendor = typeof body.vendor === "string" && body.vendor.trim() ? body.vendor.trim() : null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: expense, error } = await admin
    .from("farm_expenses")
    .update(patch)
    .eq("id", id)
    .select("id, date, category, description, amount, vendor")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  return NextResponse.json({ expense });
}

/**
 * DELETE /api/expenses/[id] — Delete expense (admin only)
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin
    .from("farm_expenses")
    .delete()
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new NextResponse(null, { status: 204 });
}
