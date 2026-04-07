/**
 * Creates shared chef accounts for Press and Under-Study kitchens.
 * Run once: npx ts-node --project tsconfig.scripts.json scripts/setup-chef-users.ts
 *
 * Set these env vars first:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Edit these before running ────────────────────────────────────────────────
const CHEF_ACCOUNTS = [
  {
    email: "press.kitchen@pressfarm.app",
    password: "pressfarm2026",
    fullName: "Press Kitchen",
    restaurantSlug: "press",
  },
  {
    email: "understudy.kitchen@pressfarm.app",
    password: "pressfarm2026",
    fullName: "Under-Study Kitchen",
    restaurantSlug: "under-study",
  },
];
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Setting up chef accounts...\n");

  // Fetch restaurants
  const { data: restaurants, error: rErr } = await admin
    .from("restaurants")
    .select("id, name, slug");
  if (rErr) throw rErr;
  console.log("Restaurants found:", restaurants?.map((r: any) => `${r.name} (${r.slug})`).join(", "));

  for (const account of CHEF_ACCOUNTS) {
    console.log(`\n--- ${account.fullName} ---`);

    // Find matching restaurant (try both slug formats)
    const restaurant = restaurants?.find(
      (r: any) =>
        r.slug === account.restaurantSlug ||
        r.slug === account.restaurantSlug.replace("-", "") ||
        r.name.toLowerCase().replace(/[-\s]/g, "") ===
          account.restaurantSlug.replace("-", "")
    );

    if (!restaurant) {
      console.error(`  ✗ Restaurant not found for slug: ${account.restaurantSlug}`);
      continue;
    }
    console.log(`  Restaurant: ${restaurant.name} (${restaurant.id})`);

    // Check if user already exists
    const { data: existing } = await admin.auth.admin.listUsers();
    const existingUser = existing?.users?.find((u: any) => u.email === account.email);

    let userId: string;

    if (existingUser) {
      console.log(`  User already exists: ${existingUser.id}`);
      userId = existingUser.id;
      // Update password in case it changed
      await admin.auth.admin.updateUserById(userId, { password: account.password });
      console.log(`  Password updated`);
    } else {
      // Create new auth user
      const { data: newUser, error: uErr } = await admin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: account.fullName, role: "chef" },
      });
      if (uErr) { console.error(`  ✗ Failed to create user:`, uErr.message); continue; }
      userId = newUser.user.id;
      console.log(`  ✓ Created auth user: ${userId}`);
    }

    // Upsert profile with chef role
    const { error: pErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: account.fullName,
        role: "chef",
        is_active: true,
      });
    if (pErr) console.error(`  ✗ Profile error:`, pErr.message);
    else console.log(`  ✓ Profile set (role: chef, active: true)`);

    // Link to restaurant (skip if already linked)
    const { data: existingLink } = await admin
      .from("restaurant_users")
      .select("id")
      .eq("user_id", userId)
      .eq("restaurant_id", restaurant.id)
      .single();

    if (existingLink) {
      console.log(`  Already linked to ${restaurant.name}`);
    } else {
      const { error: ruErr } = await admin
        .from("restaurant_users")
        .insert({ user_id: userId, restaurant_id: restaurant.id });
      if (ruErr) console.error(`  ✗ restaurant_users error:`, ruErr.message);
      else console.log(`  ✓ Linked to ${restaurant.name}`);
    }
  }

  console.log("\n✅ Done! Chef accounts ready.\n");
  console.log("Login credentials:");
  for (const a of CHEF_ACCOUNTS) {
    console.log(`  ${a.fullName}`);
    console.log(`    Email:    ${a.email}`);
    console.log(`    Password: ${a.password}`);
  }
}

main().catch(console.error);
