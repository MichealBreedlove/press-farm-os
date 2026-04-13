/**
 * Import March/April 2026 harvest lists as deliveries
 * Run: node scripts/import-march-april-deliveries.js
 *
 * Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Unit mapping
const UNIT_MAP = {
  "quart": "qt", "quarts": "qt", "qt": "qt",
  "lg to-go": "lg", "lg to-gos": "lg", "lg": "lg",
  "sm to-go": "sm", "sm to-gos": "sm", "sm": "sm",
  "green bin": "lbs", "green bins": "lbs",
  "ea": "ea", "count": "ea",
};

function parseUnit(raw) {
  const lower = raw.toLowerCase().trim();
  for (const [key, val] of Object.entries(UNIT_MAP)) {
    if (lower.includes(key)) return val;
  }
  return "ea";
}

// All the harvest list data parsed from user input
const DELIVERIES = [
  {
    date: "2026-03-07",
    restaurant: "press",
    items: [
      { name: "Mustard Flowers", qty: 1, unit: "qt" },
      { name: "Fava Flowers", qty: 1, unit: "sm" },
      { name: "Radish Flowers", qty: 4, unit: "qt" },
      { name: "Nasturtium", qty: 1, unit: "sm" },
      { name: "Mint", qty: 1, unit: "sm" },
      { name: "Oxalis", qty: 1, unit: "sm" },
      { name: "Frilly Mustard", qty: 4, unit: "lg" },
      { name: "Fava Leaves", qty: 1, unit: "sm" },
    ],
  },
  {
    date: "2026-03-07",
    restaurant: "understudy",
    items: [
      { name: "Nasturtium", qty: 1, unit: "sm" },
      { name: "Pea Flowers", qty: 2, unit: "lg" },
      { name: "Fava Flowers", qty: 1, unit: "lg" },
      { name: "Calendula Flowers", qty: 1, unit: "lg" },
      { name: "Pea Tendrils", qty: 4, unit: "lg" },
    ],
  },
  {
    date: "2026-03-09",
    restaurant: "press",
    items: [
      { name: "Mustard Flowers", qty: 1, unit: "qt" },
      { name: "Nasturtium", qty: 1, unit: "lg" },
      { name: "Nasturtium, Large", qty: 8, unit: "qt" },
      { name: "Mustard Frills", qty: 4, unit: "lg" },
      { name: "Miner's Lettuce", qty: 1, unit: "sm" },
      { name: "Ethiopian Kale", qty: 1, unit: "lg" },
    ],
  },
  {
    date: "2026-03-12",
    restaurant: "press",
    items: [
      { name: "Forget-Me-Not", qty: 1, unit: "sm" },
      { name: "Oxalis Flower", qty: 1, unit: "lg" },
      { name: "Nasturtium", qty: 200, unit: "ea" },
      { name: "Frilly Mustard", qty: 4, unit: "lg" },
      { name: "Phalaenopsis Leaves", qty: 1, unit: "lg" },
      { name: "Miner's Lettuce", qty: 100, unit: "ea" },
      { name: "Mint", qty: 1, unit: "sm" },
      { name: "Fava Flowers", qty: 1, unit: "lg" },
      { name: "Weld Cress", qty: 1, unit: "lg" },
      { name: "Bay Leaf", qty: 1, unit: "lg" },
      { name: "Nasturtium Flower", qty: 1, unit: "lg" },
    ],
  },
  {
    date: "2026-03-14",
    restaurant: "press",
    items: [
      { name: "Pea Flowers", qty: 1, unit: "sm" },
      { name: "Oxalis Flowers", qty: 1, unit: "lg" },
      { name: "Nasturtium", qty: 1, unit: "lg" },
      { name: "Oxalis", qty: 1, unit: "sm" },
      { name: "Mustard Frills", qty: 2, unit: "lg" },
      { name: "Miner's Lettuce", qty: 1, unit: "lg" },
      { name: "Fava Leaves", qty: 2, unit: "lbs" },
    ],
  },
  {
    date: "2026-03-14",
    restaurant: "understudy",
    items: [
      { name: "Forget-Me-Not", qty: 1, unit: "sm" },
      { name: "Nasturtium", qty: 1, unit: "sm" },
      { name: "Rosemary", qty: 1, unit: "lg" },
      { name: "Frilly Mustard", qty: 1, unit: "lg" },
      { name: "Salad Mix", qty: 1, unit: "lg" },
      { name: "Kale", qty: 1, unit: "lg" },
      { name: "Mustard", qty: 1, unit: "lg" },
      { name: "Tatsoi", qty: 1, unit: "lg" },
    ],
  },
  {
    date: "2026-03-19",
    restaurant: "press",
    items: [
      { name: "Mustard Flowers", qty: 2, unit: "qt" },
      { name: "Radish Flowers", qty: 3, unit: "qt" },
      { name: "Forget-Me-Not", qty: 1, unit: "sm" },
      { name: "Nasturtium", qty: 1, unit: "lg" },
      { name: "Mint", qty: 1, unit: "sm" },
      { name: "Mustard Frills", qty: 6, unit: "lg" },
      { name: "Fava Leaves", qty: 1, unit: "lg" },
      { name: "Miner's Lettuce", qty: 1, unit: "lg" },
      { name: "Nasturtium, Large", qty: 1, unit: "lg" },
    ],
  },
  {
    date: "2026-03-20",
    restaurant: "press",
    items: [
      { name: "Samples", qty: 7, unit: "ea" },
      { name: "Peach Flowers", qty: 10, unit: "lbs" },
    ],
  },
  {
    date: "2026-03-21",
    restaurant: "press",
    items: [
      { name: "Fava Flowers", qty: 1, unit: "lg" },
      { name: "Radish Flowers", qty: 2, unit: "qt" },
      { name: "Nasturtium", qty: 2, unit: "lg" },
      { name: "Mint", qty: 1, unit: "sm" },
      { name: "Oxalis", qty: 1, unit: "lg" },
      { name: "Miner's Lettuce", qty: 1, unit: "lg" },
      { name: "Fava Leaves", qty: 6, unit: "lbs" },
    ],
  },
  {
    date: "2026-03-23",
    restaurant: "press",
    items: [
      { name: "Mustard Flowers", qty: 2, unit: "qt" },
      { name: "Radish Flowers", qty: 2, unit: "qt" },
      { name: "Nasturtium", qty: 250, unit: "ea" },
      { name: "Kale", qty: 1, unit: "lg" },
      { name: "Miner's Lettuce", qty: 1, unit: "lg" },
      { name: "Oxalis", qty: 1, unit: "lg" },
    ],
  },
  {
    date: "2026-03-23",
    restaurant: "understudy",
    items: [
      { name: "Borage Flowers", qty: 130, unit: "ea" },
      { name: "Pea Flowers", qty: 120, unit: "ea" },
      { name: "Calendula", qty: 3, unit: "lg" },
      { name: "Alyssum", qty: 50, unit: "ea" },
      { name: "Spearmint", qty: 1, unit: "lg" },
      { name: "Onion Blossoms", qty: 1, unit: "sm" },
      { name: "Oxalis", qty: 1, unit: "lg" },
      { name: "Mustard Frills", qty: 8, unit: "lg" },
      { name: "Miner's Lettuce", qty: 130, unit: "ea" },
      { name: "Salad Mix", qty: 3, unit: "lg" },
    ],
  },
  {
    date: "2026-03-26",
    restaurant: "press",
    items: [
      { name: "Mustard Flowers", qty: 2, unit: "qt" },
      { name: "Phlox Flowers", qty: 2, unit: "lg" },
      { name: "Radish Flowers", qty: 2, unit: "qt" },
      { name: "Nasturtium", qty: 1, unit: "lg" },
      { name: "Oxalis", qty: 1, unit: "lg" },
      { name: "Miner's Lettuce", qty: 1, unit: "lg" },
    ],
  },
  {
    date: "2026-04-06",
    restaurant: "press",
    items: [
      { name: "Forget-Me-Not", qty: 1, unit: "sm" },
      { name: "Radish Flowers", qty: 2, unit: "qt" },
      { name: "Mustard Flowers", qty: 2, unit: "qt" },
      { name: "Nasturtium", qty: 200, unit: "ea" },
      { name: "Aptenia", qty: 1, unit: "lg" },
      { name: "Mint", qty: 1, unit: "sm" },
      { name: "Frilly Mustard", qty: 2, unit: "lg" },
      { name: "Fava Leaves", qty: 1, unit: "lg" },
      { name: "Mustard Greens", qty: 2, unit: "lg" },
      { name: "Tiny Peas", qty: 1, unit: "lg" },
    ],
  },
  {
    date: "2026-04-06",
    restaurant: "understudy",
    items: [
      { name: "Nasturtium", qty: 50, unit: "ea" },
      { name: "Rosemary", qty: 1, unit: "lg" },
      { name: "Frilly Mustard", qty: 1, unit: "lg" },
      { name: "Salad Mix", qty: 1, unit: "lg" },
      { name: "Mustard Greens", qty: 1, unit: "lg" },
      { name: "Radishes", qty: 1, unit: "lg" },
    ],
  },
  {
    date: "2026-04-09",
    restaurant: "press",
    items: [
      { name: "Radish Flowers", qty: 3, unit: "qt" },
      { name: "Nasturtium", qty: 1, unit: "lg" },
      { name: "Oxalis", qty: 2, unit: "sm" },
      { name: "Spearmint", qty: 1, unit: "sm" },
      { name: "Nasturtium, Large", qty: 2, unit: "lg" },
      { name: "Fava Leaves", qty: 1, unit: "lg" },
      { name: "Hakuri Turnips", qty: 20, unit: "ea" },
      { name: "Cherry Belle Radishes", qty: 20, unit: "ea" },
    ],
  },
];

async function main() {
  console.log(`Importing ${DELIVERIES.length} delivery records...`);

  // Fetch restaurants
  const { data: restaurants } = await supabase.from("restaurants").select("id, name");
  const restMap = {};
  for (const r of restaurants || []) {
    if (r.name.toLowerCase().includes("press") && !r.name.toLowerCase().includes("under")) {
      restMap["press"] = r.id;
    } else if (r.name.toLowerCase().includes("under")) {
      restMap["understudy"] = r.id;
    } else if (r.name.toLowerCase().includes("event")) {
      restMap["events"] = r.id;
    }
  }
  console.log("Restaurant map:", restMap);

  // Fetch all items for name matching
  const { data: items } = await supabase.from("items").select("id, name, default_price, unit_type");
  const itemMap = new Map();
  for (const item of items || []) {
    itemMap.set(item.name.toLowerCase(), item);
  }

  function findItem(name) {
    const lower = name.toLowerCase().trim();
    // Exact match
    if (itemMap.has(lower)) return itemMap.get(lower);
    // Partial match
    for (const [key, item] of itemMap) {
      if (key.includes(lower) || lower.includes(key)) return item;
    }
    // Word match
    const words = lower.split(/\s+/);
    for (const [key, item] of itemMap) {
      if (words.every(w => key.includes(w))) return item;
    }
    return null;
  }

  let importedDeliveries = 0;
  let importedItems = 0;
  let skippedItems = 0;
  const missingItems = new Set();

  for (const delivery of DELIVERIES) {
    const restaurantId = restMap[delivery.restaurant];
    if (!restaurantId) {
      console.warn(`  Skip: no restaurant for "${delivery.restaurant}"`);
      continue;
    }

    // Check if delivery already exists
    const { data: existing } = await supabase
      .from("deliveries")
      .select("id")
      .eq("delivery_date", delivery.date)
      .eq("restaurant_id", restaurantId)
      .single();

    if (existing) {
      console.log(`  Skip: delivery ${delivery.date} / ${delivery.restaurant} already exists`);
      continue;
    }

    // Build line items
    const lineItems = [];
    for (const item of delivery.items) {
      const dbItem = findItem(item.name);
      if (!dbItem) {
        missingItems.add(item.name);
        skippedItems++;
        continue;
      }
      lineItems.push({
        item_id: dbItem.id,
        quantity: item.qty,
        unit: item.unit,
        unit_price: dbItem.default_price ?? 0,
      });
    }

    if (lineItems.length === 0) {
      console.warn(`  Skip: no matching items for ${delivery.date} / ${delivery.restaurant}`);
      continue;
    }

    // Calculate total
    const totalValue = lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0);

    // Insert delivery
    const { data: newDelivery, error: delErr } = await supabase
      .from("deliveries")
      .insert({
        delivery_date: delivery.date,
        restaurant_id: restaurantId,
        status: "logged",
        total_value: Math.round(totalValue * 100) / 100,
      })
      .select()
      .single();

    if (delErr) {
      console.error(`  Error inserting delivery ${delivery.date}:`, delErr.message);
      continue;
    }

    // Insert delivery items
    const { error: itemErr } = await supabase
      .from("delivery_items")
      .insert(lineItems.map(li => ({ ...li, delivery_id: newDelivery.id })));

    if (itemErr) {
      console.error(`  Error inserting items for ${delivery.date}:`, itemErr.message);
    } else {
      importedDeliveries++;
      importedItems += lineItems.length;
      console.log(`  ✓ ${delivery.date} / ${delivery.restaurant}: ${lineItems.length} items, ${totalValue.toFixed(2)}`);
    }
  }

  console.log(`\nDone!`);
  console.log(`  Imported: ${importedDeliveries} deliveries, ${importedItems} line items`);
  console.log(`  Skipped: ${skippedItems} items (no match)`);
  if (missingItems.size > 0) {
    console.log(`  Missing items: ${[...missingItems].join(", ")}`);
  }
}

main().catch(console.error);
