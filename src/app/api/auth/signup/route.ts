import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/auth/signup — Public chef self-signup.
 *
 * Body: { email, password, full_name, restaurant_id }
 *
 * Creates an INDIVIDUAL chef account (role 'chef', is_active true) and links it
 * to the chosen restaurant via restaurant_users. Email is auto-confirmed so the
 * chef can sign in immediately. The legacy "Events" pseudo-restaurant is not a
 * valid signup target — events appear on every chef's order form via the
 * is_event_item flag, no assignment needed.
 */
export async function POST(request: Request) {
  let body: { email?: string; password?: string; full_name?: string; restaurant_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const full_name = body.full_name?.trim();
  const password = body.password ?? "";
  const restaurant_id = body.restaurant_id?.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!full_name) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!restaurant_id) {
    return NextResponse.json({ error: "Please choose a restaurant" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Confirm the restaurant exists and isn't the legacy Events pseudo-restaurant.
  const { data: restaurant, error: restErr } = await (admin as any)
    .from("restaurants")
    .select("id, name")
    .eq("id", restaurant_id)
    .single();

  if (restErr || !restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 400 });
  }
  if (/event/i.test(restaurant.name)) {
    return NextResponse.json({ error: "That restaurant isn't available for signup" }, { status: 400 });
  }

  const { data: createData, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createErr) {
    const msg = createErr.message ?? "Could not create account";
    const status = /already|registered|exists/i.test(msg) ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const newUserId = createData.user.id;

  // handle_new_user trigger inserts a profiles row with default role 'chef'.
  // Upsert to set full_name + is_active explicitly.
  const { error: profileErr } = await (admin as any)
    .from("profiles")
    .upsert(
      { id: newUserId, full_name, role: "chef", is_active: true },
      { onConflict: "id" }
    );

  if (profileErr) {
    // Roll back the auth user so the chef can retry cleanly.
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  const { error: linkErr } = await (admin as any)
    .from("restaurant_users")
    .upsert(
      { user_id: newUserId, restaurant_id },
      { onConflict: "user_id,restaurant_id" }
    );

  if (linkErr) {
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json({ error: linkErr.message }, { status: 500 });
  }

  return NextResponse.json(
    { userId: newUserId, email, restaurant: restaurant.name },
    { status: 201 }
  );
}
