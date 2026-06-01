import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/setup-shared-accounts
 *
 * One-time provisioning endpoint for the production cutover. Admin-only.
 *
 * Body: {
 *   passwords: {
 *     press: string,
 *     understudy: string,
 *     pressbar: string,
 *     events: string,
 *     receiver: string,
 *   }
 * }
 *
 * Effects (in order):
 *   1. Verify the caller is admin.
 *   2. Delete every auth.users row EXCEPT the caller. Cascades wipe the
 *      attached profiles + restaurant_users + chef-authored orders, but
 *      the user explicitly said this hasn't gone to production yet, so
 *      that data loss is intentional.
 *   3. Create 5 fresh accounts with synthetic emails
 *      "<username>@accounts.pressfarm.app", role from a fixed map,
 *      passwords from the request body. email_confirm=true so they can
 *      log in immediately without a verification step.
 *   4. Re-link the 4 chef accounts to their restaurants via
 *      restaurant_users (the handle_new_user trigger creates the profile
 *      but doesn't touch the join table).
 *
 * Idempotent in spirit but destructive by design: every call wipes and
 * recreates from scratch.
 */

const SYNTHETIC_EMAIL_DOMAIN = "accounts.pressfarm.app";

// (username, role, full_name, restaurant_name_or_null)
const ACCOUNTS: Array<{
  username: string;
  role: "chef" | "receiver";
  fullName: string;
  restaurantName: string | null;
}> = [
  { username: "press",      role: "chef",     fullName: "Press Kitchen",      restaurantName: "Press" },
  { username: "understudy", role: "chef",     fullName: "Under-Study Kitchen", restaurantName: "Understudy" },
  { username: "pressbar",   role: "chef",     fullName: "Press Bar",          restaurantName: "Press Bar" },
  { username: "events",     role: "chef",     fullName: "Events Team",        restaurantName: "Events" },
  { username: "receiver",   role: "receiver", fullName: "Receiver",           restaurantName: null },
];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin (and capture admin id for the "keep this row" step).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { passwords?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const passwords = body.passwords ?? {};
  const missing = ACCOUNTS.filter((a) => !passwords[a.username] || passwords[a.username].length < 6);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing or too-short passwords (need ≥6 chars): ${missing.map((m) => m.username).join(", ")}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // ── Step 1: enumerate + delete every non-admin user ──
  // listUsers paginates at 50 by default; bump to 1000 since this farm
  // app has fewer than a dozen accounts ever.
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) {
    return NextResponse.json({ error: `List users failed: ${listErr.message}` }, { status: 500 });
  }

  const deleted: string[] = [];
  for (const u of listed.users) {
    if (u.id === user.id) continue;
    const { error: delErr } = await admin.auth.admin.deleteUser(u.id);
    if (delErr) {
      return NextResponse.json(
        { error: `Failed deleting ${u.email ?? u.id}: ${delErr.message}` },
        { status: 500 },
      );
    }
    deleted.push(u.email ?? u.id);
  }

  // ── Step 2: pre-fetch restaurants so we can map name → id ──
  const { data: restaurants } = await admin
    .from("restaurants")
    .select("id, name");
  const restaurantByName = new Map<string, string>(
    (restaurants ?? []).map((r: any) => [String(r.name).toLowerCase(), r.id as string]),
  );

  // ── Step 3: create the 5 accounts ──
  const created: Array<{ username: string; email: string; role: string; restaurant: string | null }> = [];
  for (const acct of ACCOUNTS) {
    const email = `${acct.username}@${SYNTHETIC_EMAIL_DOMAIN}`;
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: passwords[acct.username],
      email_confirm: true,
      user_metadata: {
        full_name: acct.fullName,
        role: acct.role,
      },
    });
    if (createErr || !newUser.user) {
      return NextResponse.json(
        { error: `Failed to create ${acct.username}: ${createErr?.message ?? "unknown"}` },
        { status: 500 },
      );
    }

    // The handle_new_user trigger reads role from user_metadata, but
    // older deployments might not have that path. Force-update the
    // profile so we don't depend on trigger behavior we can't test.
    await admin
      .from("profiles")
      .update({ role: acct.role, full_name: acct.fullName, is_active: true })
      .eq("id", newUser.user.id);

    // Link chef accounts to their restaurant.
    let resolvedRestaurant: string | null = null;
    if (acct.restaurantName) {
      const rid = restaurantByName.get(acct.restaurantName.toLowerCase());
      if (rid) {
        await admin
          .from("restaurant_users")
          .insert({ user_id: newUser.user.id, restaurant_id: rid });
        resolvedRestaurant = acct.restaurantName;
      }
      // If the restaurant doesn't exist, we still return the account but
      // flag it so the admin knows to run migration 040 (Events) first.
    }

    created.push({
      username: acct.username,
      email,
      role: acct.role,
      restaurant: resolvedRestaurant,
    });
  }

  return NextResponse.json({
    ok: true,
    deleted_count: deleted.length,
    deleted_emails: deleted,
    created,
  });
}
