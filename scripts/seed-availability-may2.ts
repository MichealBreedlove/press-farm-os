/**
 * One-shot: set the items shown in the May 2 PRESS availability sheet
 * as available for Press, Under-Study, and Press Bar on 2026-05-02.
 *
 * Idempotent — availability_items has UNIQUE(item_id, restaurant_id,
 * delivery_date) so re-running upserts cleanly.
 *
 * Run:
 *   npx tsx -r dotenv/config scripts/seed-availability-may2.ts \
 *     dotenv_config_path=.env.local
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing supabase env vars");
  process.exit(1);
}
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DELIVERY_DATE = "2026-05-02";
const RESTAURANT_SLUGS = ["press", "understudy", "press-bar"];

// Each entry: a name from the screenshot mapped to its best catalog match.
// Many varietal rows on the sheet (e.g. Mint, Chocolate / Spearmint /
// Pineapple) collapse to a single catalog item ("Mint") — the script
// dedupes per (item_id, restaurant_id, delivery_date) automatically.
// Items not in the catalog get reported in the "skipped" list.
const TARGETS: { sheetName: string; catalogName: string; status?: "available" | "limited"; note?: string }[] = [
  // Flowers
  { sheetName: "Chrysanthemum", catalogName: "Chrysanthemum" },
  { sheetName: "Bachelor Buttons", catalogName: "Bachelor Button" },
  { sheetName: "Gem Marigold", catalogName: "Marigold" },
  { sheetName: "Rose Geranium", catalogName: "Rose Geranium" },
  { sheetName: "Nasturtium Flowers", catalogName: "Nasturtium Flowers" }, // may not exist
  { sheetName: "Society Garlic - Purple", catalogName: "Society Garlic", status: "limited", note: "Limited Supply (1 lg togo)" },
  { sheetName: "Violas", catalogName: "Violas" },

  // Micros - Leaves
  { sheetName: "Nasturtium (Dime-Nickel)", catalogName: "Nasturtium Dime-Nickel" }, // may not exist
  { sheetName: "Nasturtium (Quarter-Silver Dollar)", catalogName: "Nasturtium Quarter-Silver Dollar" },
  { sheetName: "Oxalis (Scarlet)", catalogName: "Oxalis" },

  // Herbs/Leaves
  { sheetName: "Aptenia", catalogName: "Aptenia", status: "limited", note: "Limited Qty (50 ea)" },
  { sheetName: "New Zealand Spinach", catalogName: "New Zealand Spinach" },
  { sheetName: "Purple Star Dust", catalogName: "Purple Stardust" },
  { sheetName: "Bay Leaf, California Bay", catalogName: "Bay Leaf" },
  { sheetName: "Bay Leaf, Traditional Bay", catalogName: "Bay Leaf" },
  { sheetName: "Fava Leaves", catalogName: "Fava Leaf" },
  { sheetName: "Green Fennel / Bronze Fennel", catalogName: "Fennel" },
  { sheetName: "Gem Marigold (herb)", catalogName: "Gem Marigold Leaf" },
  { sheetName: "Lemon Balm", catalogName: "Lemon Balm" },
  { sheetName: "Mint (Chocolate/Spearmint/Pineapple/Strawberry/Japanese)", catalogName: "Mint" },
  { sheetName: "Nasturtium (50ct), 4-6\"", catalogName: "Nasturtium Quarter-Silver Dollar" },
  { sheetName: "Rosemary, (50ct) 1-4\"", catalogName: "Rosemary" },

  // Fruit/Veg
  { sheetName: "Tiny Onions", catalogName: "Onion" },
  { sheetName: "Turnip, Hakuri 1\" - 3\"", catalogName: "Hakurei Turnip" },
  { sheetName: "Radish, Cherry Belle 1\"- 3\"", catalogName: "Radish" },
  { sheetName: "Tiny Peas", catalogName: "Peas" },
];

function normalize(s: string) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  console.log(`\n🌱 Seeding availability for ${DELIVERY_DATE}\n`);

  // 1. Ensure the delivery_date row exists. The page filter pulls from this
  //    table, so even with availability_items rows the date won't show on
  //    the chef order form unless the parent date row exists too.
  const { data: dateRow } = await (admin as any)
    .from("delivery_dates")
    .select("id, ordering_open")
    .eq("date", DELIVERY_DATE)
    .maybeSingle();
  if (!dateRow) {
    console.log(`Creating delivery_dates row for ${DELIVERY_DATE}…`);
    const dow = new Date(DELIVERY_DATE + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const { error } = await (admin as any).from("delivery_dates").insert({
      date: DELIVERY_DATE,
      day_of_week: dow,
      ordering_open: true,
    });
    if (error) {
      console.error("✗ delivery_dates insert failed:", error.message);
      process.exit(1);
    }
    console.log(`  ✓ Created (day_of_week=${dow}, ordering_open=true)`);
  } else {
    console.log(`Delivery date ${DELIVERY_DATE} exists (ordering_open=${dateRow.ordering_open})`);
  }

  // 2. Restaurants
  const { data: restaurants } = await (admin as any).from("restaurants").select("id, name, slug");
  const restaurantsBySlug = new Map<string, any>();
  for (const r of restaurants ?? []) {
    restaurantsBySlug.set(normalize(r.slug), r);
    restaurantsBySlug.set(normalize(r.name), r);
  }
  const targetRestaurants = RESTAURANT_SLUGS
    .map((s) => restaurantsBySlug.get(normalize(s)))
    .filter(Boolean);
  console.log(`\nTarget restaurants: ${targetRestaurants.map((r: any) => r.name).join(", ")}\n`);
  if (targetRestaurants.length !== RESTAURANT_SLUGS.length) {
    console.error(`Expected ${RESTAURANT_SLUGS.length} restaurants, found ${targetRestaurants.length}`);
    console.error(`Available slugs: ${(restaurants ?? []).map((r: any) => r.slug).join(", ")}`);
    process.exit(1);
  }

  // 3. Items — match by exact name first, then case/punct-insensitive
  const { data: items } = await (admin as any)
    .from("items")
    .select("id, name, category")
    .eq("is_archived", false);
  const itemsByExact = new Map<string, any>();
  const itemsByNorm = new Map<string, any>();
  for (const it of items ?? []) {
    itemsByExact.set(it.name, it);
    itemsByNorm.set(normalize(it.name), it);
  }

  const matched: { sheetName: string; item: any; status: string; note?: string }[] = [];
  const skipped: string[] = [];
  const seenItemIds = new Set<string>();
  for (const t of TARGETS) {
    const it = itemsByExact.get(t.catalogName) ?? itemsByNorm.get(normalize(t.catalogName));
    if (!it) {
      skipped.push(`${t.sheetName} → catalog name "${t.catalogName}" not found`);
      continue;
    }
    if (seenItemIds.has(it.id)) {
      // Same catalog item already covered — multiple sheet rows map to it
      console.log(`  · ${t.sheetName} → ${it.name} (already queued, skipping duplicate)`);
      continue;
    }
    seenItemIds.add(it.id);
    matched.push({
      sheetName: t.sheetName,
      item: it,
      status: t.status ?? "available",
      note: t.note,
    });
    console.log(`  ✓ ${t.sheetName} → ${it.name} (${it.category}) [${t.status ?? "available"}]`);
  }

  if (skipped.length > 0) {
    console.log(`\nNot in catalog (${skipped.length}):`);
    for (const s of skipped) console.log(`  ✗ ${s}`);
  }
  console.log(`\n${matched.length} unique items × ${targetRestaurants.length} restaurants = ${matched.length * targetRestaurants.length} availability rows\n`);

  // 4. Insert/update availability rows
  let inserted = 0;
  let updated = 0;
  for (const m of matched) {
    for (const r of targetRestaurants) {
      // Check existing
      const { data: existing } = await (admin as any)
        .from("availability_items")
        .select("id")
        .eq("item_id", m.item.id)
        .eq("restaurant_id", r.id)
        .eq("delivery_date", DELIVERY_DATE)
        .maybeSingle();

      if (existing) {
        const { error } = await (admin as any)
          .from("availability_items")
          .update({
            status: m.status,
            cycle_notes: m.note ?? null,
          })
          .eq("id", existing.id);
        if (error) {
          console.error(`  ✗ ${m.item.name} @ ${r.name}: ${error.message}`);
        } else {
          updated++;
        }
      } else {
        const { error } = await (admin as any)
          .from("availability_items")
          .insert({
            item_id: m.item.id,
            restaurant_id: r.id,
            delivery_date: DELIVERY_DATE,
            status: m.status,
            cycle_notes: m.note ?? null,
          });
        if (error) {
          console.error(`  ✗ ${m.item.name} @ ${r.name}: ${error.message}`);
        } else {
          inserted++;
        }
      }
    }
  }

  console.log(`\n✅ Done. ${inserted} inserted · ${updated} updated · ${matched.length * targetRestaurants.length - inserted - updated} errors`);
}

main().catch((err) => {
  console.error("\n❌ seed failed:", err);
  process.exit(1);
});
