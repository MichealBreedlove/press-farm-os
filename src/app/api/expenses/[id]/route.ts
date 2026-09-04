import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateExpenseInput } from "@/lib/expenses/validate";

const EXPENSE_COLUMNS = "id, date, category, description, vendor, amount, created_at";

/**
 * PATCH /api/expenses/[id] — Update an expense (admin only).
 * Body: { date, category, description?, vendor?, amount } — same shape as POST.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  const { id } = await params;

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
  const { data: expense, error } = await admin
    .from("farm_expenses")
    .update(validated.value)
    .eq("id", id)
    .select(EXPENSE_COLUMNS)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  return NextResponse.json({ expense });
}

/**
 * DELETE /api/expenses/[id] — Remove an expense (admin only).
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
