/**
 * Creates a complete set of test accounts — one chef per restaurant
 * (Press, Under-Study, Events, Press Bar) and one receiver — for
 * exercising every role-scoped flow in the app.
 *
 * Idempotent: re-running won't duplicate users. Existing accounts
 * have their password reset, profile re-upserted, and restaurant
 * link recreated if missing.
 *
 * Run:
 *   npx tsx scripts/setup-test-users.ts
 *
 * Required env vars (already in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * After running, log in via:
 *   /login → admin uses email+password
 *           → chefs / receiver use email+password too on this script
 *             (magic-link flow still works in production for chefs;
 *             this just gives you a fast credential-based path for
 *             switching between roles during testing)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  console.error("Make sure .env.local is loaded (try: npx tsx -r dotenv/config scripts/setup-test-users.ts dotenv_config_path=.env.local)");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Configuration ───────────────────────────────────────────────────────────
// Single shared password keeps testing fast — change here if your env policy
// requires something stronger. All emails point at @pressfarm.io so they're
// easy to spot in the auth.users list and clean up later.

const SHARED_PASSWORD = "pressfarm2026";

interface Account {
  email: string;
  fullName: string;
  role: "chef" | "receiver";
  /** Slug of the restaurant to link via restaurant_users. Receivers leave this null. */
  restaurantSlug: string | null;
}

const ACCOUNTS: Account[] = [
  // Chefs — one per restaurant card on /admin/orders.
  {
    email: "test-press@pressfarm.io",
    fullName: "Test · Press Chef",
    role: "chef",
    restaurantSlug: "press",
  },
  {
    email: "test-understudy@pressfarm.io",
    fullName: "Test · Under-Study Chef",
    role: "chef",
    restaurantSlug: "under-study",
  },
  {
    email: "test-events@pressfarm.io",
    fullName: "Test · Events Chef",
    role: "chef",
    restaurantSlug: "events",
  },
  {
    email: "test-pressbar@pressfarm.io",
    fullName: "Test · Press Bar Chef",
    role: "chef",
    restaurantSlug: "press-bar",
  },
  // Receiver — cross-restaurant role; no restaurant_users link needed.
  {
    email: "test-receiver@pressfarm.io",
    fullName: "Test · Receiver",
    role: "receiver",
    restaurantSlug: null,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Match a restaurant by slug, with fallback to slug-without-hyphens and name comparison. */
function findRestaurant(restaurants: any[], slug: string) {
  const normSlug = slug.toLowerCase();
  const collapsed = normSlug.replace(/-/g, "");
  return restaurants.find(
    (r) =>
      r.slug === normSlug ||
      r.slug?.replace(/-/g, "") === collapsed ||
      r.name?.toLowerCase().replace(/[-\s]/g, "") === collapsed,
  );
}

/** Find an existing auth user by email (paginated through admin.listUsers). */
async function findAuthUser(email: string) {
  const target = email.toLowerCase();
  // listUsers pages at 50 by default; iterate to be safe on bigger projects
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users?.find((u) => u.email?.toLowerCase() === target);
    if (found) return found;
    if (!data.users || data.users.length < 200) return null;
    page++;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱 Setting up test users for Press Farm OS\n");

  const { data: restaurants, error: rErr } = await admin
    .from("restaurants")
    .select("id, name, slug");
  if (rErr) throw rErr;

  console.log(
    "Restaurants in DB: " +
      (restaurants?.map((r: any) => `${r.name}(${r.slug})`).join(", ") || "none"),
  );
  console.log("");

  const created: { account: Account; userId: string; restaurantName: string | null }[] = [];

  for (const account of ACCOUNTS) {
    console.log(`── ${account.fullName} (${account.role})`);

    let restaurant = null as any;
    if (account.restaurantSlug) {
      restaurant = findRestaurant(restaurants ?? [], account.restaurantSlug);
      if (!restaurant) {
        console.error(`   ✗ Restaurant not found for slug "${account.restaurantSlug}". Skipping.`);
        continue;
      }
      console.log(`   Restaurant: ${restaurant.name} (${restaurant.id})`);
    } else {
      console.log(`   Restaurant: (none — ${account.role} is cross-restaurant)`);
    }

    // 1. Auth user — create or update password if exists
    let userId: string;
    const existing = await findAuthUser(account.email);
    if (existing) {
      userId = existing.id;
      console.log(`   ↻ Auth user exists (${userId.slice(0, 8)}…) — resetting password`);
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password: SHARED_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: account.fullName, role: account.role },
      });
      if (error) {
        console.error(`   ✗ updateUserById:`, error.message);
        continue;
      }
    } else {
      const { data: newUser, error } = await admin.auth.admin.createUser({
        email: account.email,
        password: SHARED_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: account.fullName, role: account.role },
      });
      if (error || !newUser?.user) {
        console.error(`   ✗ createUser:`, error?.message ?? "unknown error");
        continue;
      }
      userId = newUser.user.id;
      console.log(`   ✓ Created auth user (${userId.slice(0, 8)}…)`);
    }

    // 2. Profile — upsert role + active flag
    const { error: pErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        full_name: account.fullName,
        role: account.role,
        is_active: true,
      });
    if (pErr) {
      console.error(`   ✗ profiles upsert:`, pErr.message);
      continue;
    }
    console.log(`   ✓ Profile (role=${account.role}, is_active=true)`);

    // 3. Restaurant link — chef-only, dedupe on conflict
    if (restaurant) {
      const { data: existingLink } = await admin
        .from("restaurant_users")
        .select("id")
        .eq("user_id", userId)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();

      if (existingLink) {
        console.log(`   ↻ Already linked to ${restaurant.name}`);
      } else {
        const { error: ruErr } = await admin
          .from("restaurant_users")
          .insert({ user_id: userId, restaurant_id: restaurant.id });
        if (ruErr) {
          console.error(`   ✗ restaurant_users insert:`, ruErr.message);
          continue;
        }
        console.log(`   ✓ Linked to ${restaurant.name}`);
      }
    }

    created.push({
      account,
      userId,
      restaurantName: restaurant?.name ?? null,
    });
    console.log("");
  }

  // ─── Summary ───
  console.log("───────────────────────────────────────────");
  console.log(`✅ Done — ${created.length}/${ACCOUNTS.length} accounts ready\n`);
  console.log(`Shared password: ${SHARED_PASSWORD}\n`);
  console.log("Login at /login (email + password):");
  for (const c of created) {
    console.log(`  • ${c.account.email}`);
    console.log(`      Role:       ${c.account.role}`);
    console.log(`      Restaurant: ${c.restaurantName ?? "(cross-restaurant)"}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("\n❌ setup-test-users failed:", err);
  process.exit(1);
});
