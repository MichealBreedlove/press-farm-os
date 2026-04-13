/**
 * Import delivery line items from suggestion box data.
 * Parses the tab-separated delivery data and imports into deliveries + delivery_items.
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function parseDate(d) {
  // Format: "16-Jan-25" or "1-Feb-26"
  const months = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
  const parts = d.trim().split("-");
  if (parts.length !== 3) return null;
  const day = parts[0].padStart(2, "0");
  const mon = months[parts[1]];
  const yr = parseInt(parts[2]) < 50 ? "20" + parts[2] : "19" + parts[2];
  if (!mon) return null;
  return `${yr}-${mon}-${day}`;
}

async function run() {
  // Get the suggestion text
  const { data: suggestion } = await admin.from("suggestions").select("id, text").ilike("text", "%16-Jan-25%").single();
  if (!suggestion) { console.log("Suggestion not found"); return; }

  const text = suggestion.text;
  const lines = text.split("\n").filter(l => l.trim());

  // Get Press restaurant ID
  const { data: restaurants } = await admin.from("restaurants").select("id, name");
  const pressId = restaurants.find(r => r.name.toLowerCase().includes("press"))?.id;
  console.log("Press restaurant:", pressId);

  // Get items for matching
  const { data: items } = await admin.from("items").select("id, name");
  const itemMap = {};
  for (const i of items) itemMap[i.name.toLowerCase().trim()] = i.id;

  // Parse delivery line items grouped by date
  const deliveryData = {}; // date -> [{item_name, qty, unit, price, total}]

  for (const line of lines) {
    const parts = line.split("\t").map(s => s.trim());
    if (parts.length < 5) continue;

    let dateStr = null;
    let itemName, qty, unit, price;

    // Check if first col is a date
    const parsed = parseDate(parts[0]);
    if (parsed) {
      dateStr = parsed;
      itemName = parts[1];
      qty = parseFloat(parts[2]);
      unit = parts[3];
      price = parseFloat(parts[4].replace(/[$,]/g, ""));
    } else {
      continue;
    }

    if (!dateStr || !itemName || isNaN(qty) || isNaN(price)) continue;

    if (!deliveryData[dateStr]) deliveryData[dateStr] = [];
    deliveryData[dateStr].push({ item_name: itemName, qty, unit: unit.toLowerCase(), price });
  }

  const dates = Object.keys(deliveryData).sort();
  console.log("Parsed", dates.length, "delivery dates");
  console.log("Date range:", dates[0], "to", dates[dates.length - 1]);

  // Check existing deliveries to avoid duplicates
  const { data: existing } = await admin.from("deliveries").select("delivery_date, id").eq("restaurant_id", pressId);
  const existingMap = {};
  for (const d of existing) existingMap[d.delivery_date] = d.id;

  let newDeliveries = 0, updatedDeliveries = 0, totalItems = 0, missingItems = new Set();

  for (const date of dates) {
    const lineItems = deliveryData[date];
    const total = lineItems.reduce((s, li) => s + (li.qty * li.price), 0);

    let deliveryId = existingMap[date];

    if (deliveryId) {
      // Delete old items and update total
      await admin.from("delivery_items").delete().eq("delivery_id", deliveryId);
      await admin.from("deliveries").update({ total_value: total }).eq("id", deliveryId);
      updatedDeliveries++;
    } else {
      // Create new delivery
      const { data: newDel, error } = await admin.from("deliveries").insert({
        restaurant_id: pressId,
        delivery_date: date,
        total_value: total,
        status: "finalized",
      }).select("id").single();
      if (error) { console.error("Delivery error:", date, error.message); continue; }
      deliveryId = newDel.id;
      newDeliveries++;
    }

    // Insert line items
    const items_to_insert = [];
    for (const li of lineItems) {
      const itemId = itemMap[li.item_name.toLowerCase().trim()];
      if (!itemId) { missingItems.add(li.item_name); continue; }
      items_to_insert.push({
        delivery_id: deliveryId,
        item_id: itemId,
        quantity: li.qty,
        unit: li.unit,
        unit_price: li.price,
      });
    }

    if (items_to_insert.length > 0) {
      const { error } = await admin.from("delivery_items").insert(items_to_insert);
      if (error) console.error("Items error:", date, error.message);
      else totalItems += items_to_insert.length;
    }
  }

  console.log("\nNew deliveries:", newDeliveries);
  console.log("Updated deliveries:", updatedDeliveries);
  console.log("Total line items:", totalItems);

  if (missingItems.size > 0) {
    console.log("\nItems not found in DB (" + missingItems.size + "):");
    for (const name of [...missingItems].sort().slice(0, 20)) console.log("  -", name);
  }

  // Mark suggestion as implemented
  await admin.from("suggestions").update({ status: "implemented" }).eq("id", suggestion.id);

  // Final counts
  const { count: delCount } = await admin.from("deliveries").select("*", { count: "exact", head: true });
  const { count: diCount } = await admin.from("delivery_items").select("*", { count: "exact", head: true });
  console.log("\nFinal: deliveries=" + delCount + " items=" + diCount);
}

run().catch(console.error);
