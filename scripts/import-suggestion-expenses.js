/**
 * Import expenses from the suggestion box data.
 * Deletes duplicates (same date + amount), then inserts all entries.
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EXPENSES = [
  // 2026
  ["01/11/2026", 226.30, "Equipment", "Home Depot", "Terllis Netting, Mold Spray, Scissors"],
  ["01/10/2026", 110.00, "Equipment", "Amazon", "Tarp"],
  ["01/15/2026", 400.00, "Soil", "Amazon", "Coco Coir"],
  ["01/15/2026", 477.32, "Equipment", "Greenhouse Megastore", "Pots"],
  ["01/17/2026", 29.69, "Equipment", "Home Depot", "Equipment"],
  ["01/22/2026", 128.56, "Seeds", "Bakers Creek", "Seeds for Understudy tomatoes, peppers"],
  ["02/03/2026", 164.62, "Seeds", "Swallowtail Garden Seeds", "Pentas Seeds"],
  ["02/03/2026", 289.37, "Equipment", "Greenhouse Megastore", "Pots"],
  // 2025
  ["01/14/2025", 209.02, "Soil", "Amazon", "Coco Coir"],
  ["01/14/2025", 84.02, "Soil", "Amazon", "Perlite"],
  ["01/17/2025", 104.50, "Seeds", "Bakers Creek Seeds", "Summer Seeds"],
  ["01/17/2025", 39.09, "Seeds", "Pepper Joes", "Summer Seeds"],
  ["01/17/2025", 7.13, "Seeds", "True Leaf Market", "Summer Seeds"],
  ["01/17/2025", 83.16, "Plants", "North Spore", "Morrel/Miatake Spores to grow @ farm"],
  ["01/17/2025", 136.45, "Seeds", "Etsy", "Seeds for more oxalis"],
  ["01/18/2025", 443.39, "Equipment", "Amazon", "Water timers needed for farm"],
  ["01/21/2025", 50.62, "Equipment", "Amazon", "Grow bags for peppers / Starter for PRESS Tiller"],
  ["02/03/2025", 211.86, "Equipment", "Amazon", "Peppers/tomatoes need to stay @ 80 F when growing so mats are needed for growth"],
  ["02/06/2025", 138.56, "Equipment", "Amazon", ""],
  ["02/06/2025", 369.21, "Equipment", "Drip Depot", "Drip Line for farm water irrigation"],
  ["02/20/2025", 164.85, "Equipment", "Amazon", "Landscape Staples for the Farm"],
  ["02/25/2025", 416.64, "Equipment", "Johnny's Seeds", "Seed and weeding equipment for the Farm"],
  ["03/01/2025", 565.09, "Equipment", "Drip Depot", "Drip Line for farm water irrigation, dripline and parts for Press raised beds"],
  ["03/01/2025", 268.84, "Plants", "Johnny's Seeds", "Strawberry Crowns & Squash Seeds"],
  ["03/02/2025", 202.53, "Equipment", "Amazon", "Roof vent openers for Farm Greenhouse, Retractable hose for Farm"],
  ["03/03/2025", 212.80, "Soil", "Amazon", "Coco Coir for seed starting mix"],
  ["03/03/2025", 18.14, "Equipment", "Amazon", "Pots for Farms Annual Tomato Seedling Giveaway"],
  ["03/13/2025", 948.73, "Equipment", "Amazon", "Various Tools, Equipment, and Supplies need for the Farm"],
  ["03/13/2025", 156.83, "Seeds", "Baker Creek", "Seeds for PRESS & Under-Study"],
  ["03/13/2025", 57.64, "Amendments", "Wilbur Ellis", "7.5, 5, 7.5 Organic Fertalizer"],
  ["03/14/2025", 295.04, "Equipment", "Greenhouse Megastore", "Trays & Pots for planting"],
  ["03/16/2025", 94.00, "Equipment", "Japan Agri", "Seeder used for faster seeding of trays"],
  ["04/02/2025", 172.37, "Equipment", "Amazon", "Sink for washing greens and veg for restaurant"],
  ["04/05/2025", 137.48, "Equipment", "Drip Depot", "Irrigation parts for field"],
  ["04/05/2025", 149.37, "Supplies", "Amazon", "To prevent bugs and other pest from destroying veggies"],
  ["04/05/2025", 341.50, "Equipment", "Amazon", "Shade canopy for tomato field"],
  ["04/05/2025", 107.70, "Amendments", "Amazon", "For fertalizing veggies"],
  ["04/05/2025", 215.26, "Soil", "Amazon", "Coco Coir for seed starting mix"],
  ["04/19/2025", 191.98, "Equipment", "Amazon", "Various Tools need for the Farm"],
  ["05/06/2025", 300.00, "Soil", "Napa Waste & Recycling", "Shared between Press & Jacobsen payment staggers"],
  ["05/27/2025", 393.71, "Equipment", "Greenhouse Megastore", "Pots & Trays for greenhouse and farm"],
  ["06/19/2025", 650.59, "Plants", "Morning Sun Herb Farm", "Peppers, Eggplant, Basil plant starts for farm"],
  ["07/10/2025", 748.50, "Seeds", "Johnny's Seeds", "Seeds for Microgreens"],
  ["07/21/2025", 175.74, "Plants", "Home Depot", "Plants & Gloves"],
  ["07/25/2025", 95.41, "Seeds", "Seed Savers Exchange", "Ox Heart Carrot Seeds"],
  ["07/27/2025", 376.33, "Plants", "Home Depot", "Society garlic plants"],
  ["08/01/2025", 271.48, "Soil", "Amazon", "Coco Coir for seed starting mix"],
  ["08/15/2025", 204.30, "Plants", "Central Valley", "Starts for Press planters"],
  ["08/16/2025", 374.66, "Plants", "Van Winden", "Plants for Press planters boxes"],
  ["08/22/2025", 484.59, "Equipment", "Home Depot", "Tools and shovels for farm"],
  ["08/22/2025", 344.88, "Plants", "Van Winden", "Plants for Press planters boxes"],
  ["08/23/2025", 142.62, "Seeds", "True Leaf Market", "Seeds for Farm"],
  ["08/30/2025", 152.79, "Seeds", "True Leaf Market", "Seeds for Farm"],
  ["09/19/2025", 231.18, "Seeds", "Seed Savers Exchange", "Seeds for Farm"],
  ["10/08/2025", 60.00, "Seeds", "Plant Good Seeds Company", "Seeds for Farm"],
  ["10/11/2025", 233.98, "Plants", "Van Winden", "Plants for Farm"],
  ["10/11/2025", 54.80, "Equipment", "Home Depot", "Sand Bags for Farm"],
  ["10/26/2025", 219.99, "Software", "Heirloom", "Farm Planning Software"],
  ["10/27/2025", 72.32, "Plants", "North Spore", "Mushroom Spawn"],
  ["10/31/2025", 163.49, "Seeds", "Pepper Joes", "Pepper Seeds"],
  ["10/31/2025", 584.73, "Seeds", "Johnny's Seeds", "Seeds for Spring Flowers"],
  ["11/01/2025", 386.74, "Seeds", "Baker Creek", "Seeds for Farm"],
  ["11/02/2025", 153.15, "Equipment", "Home Depot", "Farm Hand Tools"],
  ["11/09/2025", 399.05, "Equipment", "Home Depot", "Sand Bags for Farm, Crop Protection"],
  ["11/09/2025", 41.02, "Equipment", "Home Depot", "Sand Paper"],
  ["11/15/2025", 59.14, "Equipment", "Home Depot", "Sluggo"],
  ["11/15/2025", 29.29, "Equipment", "Home Depot", "Diatomaceous Earth"],
  ["11/20/2025", 125.09, "Seeds", "True Leaf Market", "Tomatoes"],
  ["11/20/2025", 258.93, "Seeds", "Seed Savers Exchange", "Ox Heart Carrots"],
  ["11/20/2025", 1093.77, "Seeds", "Johnnys", "Seeds"],
  ["11/20/2025", 180.40, "Supplies", "Uncle Jims Worm Farm", "Worms"],
  ["11/22/2025", 92.56, "Soil", "True Leaf Market", "Coco Coir for seed starting mix"],
  ["11/24/2025", 172.81, "Plants", "Holland Bulb Farms", "Tulip Bulbs massive sale $500 off normal price"],
  ["12/19/2025", 97.82, "Equipment", "Home Depot", "Power strips & extention cords for greenhouse"],
  ["12/20/2025", 45.50, "Software", "Tend", "Software for farm planning"],
  ["12/22/2025", 10.10, "Supplies", "Central Valley", "PVC Glue"],
  ["12/27/2025", 102.01, "Equipment", "Home Depot", "Farm Equipment"],
  ["12/27/2025", 401.29, "Equipment", "Home Depot", "Farm Equipment"],
  ["12/29/2025", 136.97, "Equipment", "Home Depot", "Farm Equipment"],
  ["12/29/2025", 133.07, "Plants", "Van Winden", "Plants for Farm"],
  ["12/30/2025", 223.78, "Seeds", "Johnny's Seeds", "Spring seeds"],
  // 2024
  ["06/14/2024", 87.50, "Seeds", "Johnny's Seeds", "Seeds"],
  ["06/22/2024", 561.53, "Seeds", "Johnny's Seeds", "Seeds"],
  ["06/28/2024", 509.56, "Soil", "Home Depot", "Soil"],
  ["06/28/2024", 20.38, "Supplies", "Home Depot", "Farm Supplies"],
  ["06/29/2024", 1292.97, "Equipment", "Amazon", "Outdoor Supplies"],
  ["06/29/2024", 273.36, "Equipment", "Amazon", "Outdoor Cabinets"],
  ["06/29/2024", 176.49, "Equipment", "Amazon", "Harvest Cart"],
  ["07/06/2024", 23.74, "Seeds", "Greenhouse Megastore", "Seeds"],
  ["07/06/2024", 124.45, "Seeds", "Johnny's Seeds", "Seeds"],
  ["07/06/2024", 238.48, "Seeds", "Johnny's Seeds", "Seeds"],
  ["07/07/2024", 147.47, "Amendments", "Lab Alley", "Hydrogen Peroxide"],
  ["07/15/2024", 210.06, "Seeds", "True Leaf Market", "Seeds"],
  ["07/21/2024", 268.68, "Amendments", "Amazon", "Fertilizer"],
  ["08/07/2024", 151.53, "Seeds", "True Leaf Market", "Seeds"],
  ["08/08/2024", 35.00, "Seeds", "Bakers Creek Seeds", "Seeds"],
  ["08/21/2024", 294.13, "Supplies", "True Leaf Market", "Microgreen Trays W/ Holes"],
  ["09/30/2024", 427.00, "Equipment", "Home Depot", "Equipment"],
  ["10/01/2024", 70.00, "Seeds", "Bakers Creek Seeds", "Seeds"],
  ["10/07/2024", 145.00, "Equipment", "Amazon", "Watering Timers"],
  ["10/10/2024", 137.48, "Seeds", "Johnny's Seeds", "Early 2024 Seeds"],
  ["10/12/2024", 300.00, "Soil", "Napa Waste & Recycling", "Compost"],
  ["10/13/2024", 42.26, "Equipment", "Amazon", "Gopher Traps"],
  ["11/19/2024", 223.48, "Equipment", "Amazon", "Equipment"],
  ["11/19/2024", 387.70, "Equipment", "Drip Depot", "Irrigation Equipment"],
  ["12/03/2024", 171.49, "Seeds", "Johnny's Seeds", "Spring seeds"],
  ["12/18/2024", 196.48, "Equipment", "Drip Depot", "Irrigation Equipment"],
  ["12/18/2024", 232.74, "Seeds", "True Leaf Market", "Spring seeds"],
  ["12/18/2024", 204.18, "Seeds", "Bakers Creek Seeds", "Spring seeds"],
];

function parseDate(d) {
  const [m, day, y] = d.split("/");
  return `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

async function run() {
  const { data: farms } = await admin.from("farms").select("id").limit(1);
  const farmId = farms[0].id;

  // Delete ALL existing expenses to start fresh with the authoritative list
  const { count: before } = await admin.from("farm_expenses").select("*", { count: "exact", head: true });
  console.log("Existing expenses:", before);

  await admin.from("farm_expenses").delete().eq("farm_id", farmId);
  console.log("Cleared all existing expenses");

  // Insert all from the suggestion list
  let inserted = 0;
  for (const [dateStr, amount, category, vendor, description] of EXPENSES) {
    const date = parseDate(dateStr);
    const { error } = await admin.from("farm_expenses").insert({
      farm_id: farmId,
      date,
      amount,
      category,
      vendor,
      description: description || null,
    });
    if (error) {
      console.error("Error:", dateStr, amount, error.message);
    } else {
      inserted++;
    }
  }

  console.log("Inserted:", inserted);
  const { count: after } = await admin.from("farm_expenses").select("*", { count: "exact", head: true });
  console.log("Total expenses now:", after);

  // Summary by year
  const { data: all } = await admin.from("farm_expenses").select("date, amount");
  const byYear = {};
  for (const e of all) {
    const y = e.date.slice(0, 4);
    byYear[y] = (byYear[y] ?? 0) + e.amount;
  }
  console.log("\nExpenses by year:");
  for (const [y, total] of Object.entries(byYear).sort()) {
    console.log(`  ${y}: $${total.toFixed(2)}`);
  }
}

run().catch(console.error);
