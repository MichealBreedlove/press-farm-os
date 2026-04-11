/**
 * Auto-extract vendors from existing expense descriptions.
 * Many descriptions follow "Item — Vendor — Details" format.
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Known vendors to match against
const KNOWN_VENDORS = [
  "Amazon", "Home Depot", "Bakers Creek", "Baker Creek", "Johnny's Seeds",
  "Seed Savers Exchange", "True Leaf Market", "Greenhouse Megastore",
  "Van Winden", "Central Valley", "Napa Waste & Recycling", "Drip Depot",
  "Morning Sun Herb Farm", "Swallowtail Garden Seeds", "Johnny's",
  "Territorial Seed", "Kitazawa Seeds", "Peaceful Valley",
];

async function run() {
  const { data: expenses } = await admin.from("farm_expenses")
    .select("id, description, vendor, category")
    .is("vendor", null);

  console.log("Expenses without vendor:", expenses?.length);

  let updated = 0;
  for (const exp of expenses ?? []) {
    if (!exp.description) continue;
    const desc = exp.description;

    // Try to match known vendors in the description
    let vendor = null;
    for (const v of KNOWN_VENDORS) {
      if (desc.toLowerCase().includes(v.toLowerCase())) {
        vendor = v;
        break;
      }
    }

    // Try "Item — Vendor — Details" pattern
    if (!vendor && desc.includes("—")) {
      const parts = desc.split("—").map(s => s.trim());
      if (parts.length >= 2) {
        vendor = parts[1]; // Second part is usually the vendor
      }
    }

    // Try "(Vendor)" pattern from 2026 imports
    if (!vendor && desc.includes("(")) {
      const match = desc.match(/\(([^)]+)\)/);
      if (match) vendor = match[1];
    }

    if (vendor) {
      await admin.from("farm_expenses").update({ vendor }).eq("id", exp.id);
      updated++;
    }
  }

  console.log("Auto-assigned vendors:", updated);

  // Show unique vendors
  const { data: all } = await admin.from("farm_expenses").select("vendor").not("vendor", "is", null);
  const vendors = [...new Set(all.map(e => e.vendor))].sort();
  console.log("Unique vendors:", vendors.join(", "));
}

run().catch(console.error);
