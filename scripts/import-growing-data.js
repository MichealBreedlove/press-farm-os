/**
 * Import growing conditions data for items.
 * Data sourced from Johnny's Seeds, Cornell growing guides, and standard references.
 * Zone 9b (Yountville, CA) specific where applicable.
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Growing data: name pattern -> growing info
// Matches items by partial name (case-insensitive)
const GROWING_DATA = [
  // FLOWERS
  { pattern: "alyssum", days_to_maturity: 60, sow_depth: "surface", plant_spacing: "6-8 in", sun_requirement: "full_sun", soil_temp_min: 55, sow_method: "both", indoor_start_weeks: 6, growing_notes: "Press lightly onto soil surface. Needs light to germinate." },
  { pattern: "bachelor button", days_to_maturity: 75, sow_depth: "1/4 in", plant_spacing: "8-12 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "direct_seed", growing_notes: "Direct sow in early spring. Deadhead for continued bloom." },
  { pattern: "borage", days_to_maturity: 55, sow_depth: "1/2 in", plant_spacing: "12 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "direct_seed", growing_notes: "Direct sow after last frost. Self-seeds readily. Edible flowers and leaves." },
  { pattern: "calendula", days_to_maturity: 50, sow_depth: "1/4 in", plant_spacing: "8-12 in", sun_requirement: "full_sun", soil_temp_min: 55, sow_method: "both", indoor_start_weeks: 4, growing_notes: "Cool-season flower. Tolerates light frost. Harvest flowers when fully open." },
  { pattern: "chamomile", days_to_maturity: 60, sow_depth: "surface", plant_spacing: "6-8 in", sun_requirement: "full_sun", soil_temp_min: 55, sow_method: "both", indoor_start_weeks: 6, growing_notes: "Tiny seeds — surface sow. German chamomile is annual. Harvest flowers for tea." },
  { pattern: "chrysanthemum", days_to_maturity: 65, sow_depth: "surface", plant_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 65, sow_method: "transplant", indoor_start_weeks: 8, growing_notes: "Edible leaves (shungiku) and flowers. Harvest young leaves for salads." },
  { pattern: "cosmos", days_to_maturity: 60, sow_depth: "1/4 in", plant_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 65, sow_method: "direct_seed", growing_notes: "Direct sow after last frost. Poor soil is fine — too much fertility reduces flowers." },
  { pattern: "dianthus", days_to_maturity: 75, sow_depth: "surface", plant_spacing: "8-12 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "transplant", indoor_start_weeks: 8, growing_notes: "Surface sow — needs light. Edible petals with clove-like flavor." },
  { pattern: "marigold", days_to_maturity: 50, sow_depth: "1/4 in", plant_spacing: "8-12 in", sun_requirement: "full_sun", soil_temp_min: 65, sow_method: "both", indoor_start_weeks: 4, growing_notes: "Gem marigolds are best for edible flowers. Citrusy flavor." },
  { pattern: "nasturtium", days_to_maturity: 55, sow_depth: "1/2-1 in", plant_spacing: "8-12 in", sun_requirement: "sun_part_shade", soil_temp_min: 60, sow_method: "direct_seed", growing_notes: "Direct sow. Seeds need darkness. Poor soil = more flowers. Edible flowers, leaves, pods." },
  { pattern: "sunflower", days_to_maturity: 70, sow_depth: "1 in", plant_spacing: "12-24 in", sun_requirement: "full_sun", soil_temp_min: 65, sow_method: "direct_seed", growing_notes: "Direct sow after last frost. Succession plant every 2 weeks for continuous cut flowers." },
  { pattern: "viola", days_to_maturity: 65, sow_depth: "1/8 in", plant_spacing: "6-8 in", sun_requirement: "sun_part_shade", soil_temp_min: 55, sow_method: "transplant", indoor_start_weeks: 8, growing_notes: "Cool-season. Needs darkness to germinate. Edible flowers." },

  // HERBS
  { pattern: "basil", days_to_maturity: 60, sow_depth: "1/4 in", plant_spacing: "8-12 in", sun_requirement: "full_sun", soil_temp_min: 70, sow_method: "both", indoor_start_weeks: 6, growing_notes: "Warm-season herb. Pinch flower buds to promote leaf growth. Min soil temp 70°F." },
  { pattern: "chervil", days_to_maturity: 50, sow_depth: "1/4 in", plant_spacing: "6-8 in", sun_requirement: "part_shade", soil_temp_min: 55, sow_method: "direct_seed", growing_notes: "Cool-season. Bolts in heat. Direct sow in spring/fall. Parsley family." },
  { pattern: "cilantro", days_to_maturity: 50, sow_depth: "1/4 in", plant_spacing: "6-8 in", sun_requirement: "sun_part_shade", soil_temp_min: 55, sow_method: "direct_seed", growing_notes: "Succession sow every 2-3 weeks. Bolts quickly in heat. Harvest young leaves." },
  { pattern: "dill", days_to_maturity: 45, sow_depth: "1/4 in", plant_spacing: "8-12 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "direct_seed", growing_notes: "Direct sow. Doesn't transplant well. Succession plant for continuous supply." },
  { pattern: "fennel", days_to_maturity: 65, sow_depth: "1/4 in", plant_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "direct_seed", growing_notes: "Direct sow in spring. Bronze fennel is perennial. Harvest fronds and flowers." },
  { pattern: "lemon balm", days_to_maturity: 70, sow_depth: "surface", plant_spacing: "12-18 in", sun_requirement: "sun_part_shade", soil_temp_min: 60, sow_method: "transplant", indoor_start_weeks: 6, growing_notes: "Perennial. Spreads vigorously. Harvest before flowering for best flavor." },
  { pattern: "mint", days_to_maturity: 60, sow_depth: "surface", plant_spacing: "18-24 in", sun_requirement: "sun_part_shade", soil_temp_min: 60, sow_method: "transplant", growing_notes: "Perennial. Very invasive — grow in containers. Harvest tips regularly." },
  { pattern: "oregano", days_to_maturity: 80, sow_depth: "surface", plant_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 65, sow_method: "transplant", indoor_start_weeks: 8, growing_notes: "Perennial. Surface sow tiny seeds. Best flavor from flowering plants." },
  { pattern: "rosemary", days_to_maturity: 90, sow_depth: "surface", plant_spacing: "24-36 in", sun_requirement: "full_sun", soil_temp_min: 65, sow_method: "transplant", growing_notes: "Perennial shrub. Start from cuttings or transplants. Well-drained soil essential." },
  { pattern: "sage", days_to_maturity: 75, sow_depth: "1/4 in", plant_spacing: "18-24 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "transplant", indoor_start_weeks: 6, growing_notes: "Perennial. Harvest before flowering. Prune to maintain shape." },
  { pattern: "shiso", days_to_maturity: 70, sow_depth: "1/4 in", plant_spacing: "12-18 in", sun_requirement: "sun_part_shade", soil_temp_min: 65, sow_method: "both", indoor_start_weeks: 6, growing_notes: "Japanese perilla. Self-seeds. Green and purple varieties. Tips and wrapping leaves." },
  { pattern: "tarragon", days_to_maturity: 90, sow_depth: "surface", plant_spacing: "18-24 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "transplant", growing_notes: "French tarragon cannot be grown from seed — use divisions or cuttings." },
  { pattern: "thyme", days_to_maturity: 85, sow_depth: "surface", plant_spacing: "8-12 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "transplant", indoor_start_weeks: 8, growing_notes: "Perennial. Tiny seeds surface sow. Well-drained soil. Harvest flowering stems." },

  // VEGETABLES & ROOTS
  { pattern: "arugula", days_to_maturity: 40, sow_depth: "1/4 in", plant_spacing: "4-6 in", sun_requirement: "sun_part_shade", soil_temp_min: 45, sow_method: "direct_seed", growing_notes: "Cool-season. Fast growing. Succession sow every 2-3 weeks. Bolts in heat." },
  { pattern: "broccoli", days_to_maturity: 60, sow_depth: "1/4 in", plant_spacing: "18-24 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "transplant", indoor_start_weeks: 6, growing_notes: "Cool-season brassica. Harvest central head, side shoots continue producing." },
  { pattern: "cabbage", days_to_maturity: 70, sow_depth: "1/4 in", plant_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "transplant", indoor_start_weeks: 6, growing_notes: "Cool-season. Conical/Savoy types. Needs consistent moisture." },
  { pattern: "carrot", days_to_maturity: 65, sow_depth: "1/4 in", plant_spacing: "2-3 in", row_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 50, sow_method: "direct_seed", growing_notes: "Direct sow. Thin to 2-3 inches. Loose soil essential. Keep moist until germination." },
  { pattern: "cauliflower", days_to_maturity: 55, sow_depth: "1/4 in", plant_spacing: "18-24 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "transplant", indoor_start_weeks: 6, growing_notes: "Cool-season. Sprouting cauliflower produces multiple small heads over time." },
  { pattern: "cucumber", days_to_maturity: 55, sow_depth: "1/2-1 in", plant_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 65, sow_method: "both", indoor_start_weeks: 3, growing_notes: "Warm-season. Train on trellis for straighter fruit. Harvest young for best quality." },
  { pattern: "eggplant", days_to_maturity: 70, sow_depth: "1/4 in", plant_spacing: "18-24 in", sun_requirement: "full_sun", soil_temp_min: 75, sow_method: "transplant", indoor_start_weeks: 8, growing_notes: "Warm-season. Needs heat. Fairy Tale is compact. Harvest when skin is glossy." },
  { pattern: "kale", days_to_maturity: 55, sow_depth: "1/4-1/2 in", plant_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 55, sow_method: "both", indoor_start_weeks: 4, growing_notes: "Cool-season brassica. Harvest outer leaves. Flavor improves after frost." },
  { pattern: "lettuce", days_to_maturity: 45, sow_depth: "1/8-1/4 in", plant_spacing: "6-12 in", sun_requirement: "sun_part_shade", soil_temp_min: 45, sow_method: "both", indoor_start_weeks: 4, growing_notes: "Cool-season. Succession sow every 2 weeks. Bolts in heat. Many types: gem, butterhead, romaine." },
  { pattern: "mizuna", days_to_maturity: 40, sow_depth: "1/4 in", plant_spacing: "6-8 in", sun_requirement: "sun_part_shade", soil_temp_min: 50, sow_method: "direct_seed", growing_notes: "Japanese mustard green. Fast growing. Mild peppery flavor. Cut-and-come-again." },
  { pattern: "mustard", days_to_maturity: 35, sow_depth: "1/4 in", plant_spacing: "6-8 in", sun_requirement: "sun_part_shade", soil_temp_min: 50, sow_method: "direct_seed", growing_notes: "Very fast. Succession sow. Dragons Tongue, Red Garnet, Frills varieties." },
  { pattern: "okra", days_to_maturity: 55, sow_depth: "1/2-1 in", plant_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 75, sow_method: "direct_seed", growing_notes: "Warm-season. Soak seeds overnight before planting. Harvest pods young (2-3 in)." },
  { pattern: "pea", days_to_maturity: 60, sow_depth: "1-2 in", plant_spacing: "2-4 in", sun_requirement: "full_sun", soil_temp_min: 45, sow_method: "direct_seed", growing_notes: "Cool-season. Direct sow early spring. Provide trellis. Edible flowers, tendrils, pods." },
  { pattern: "pepper", days_to_maturity: 70, sow_depth: "1/4 in", plant_spacing: "18-24 in", sun_requirement: "full_sun", soil_temp_min: 75, sow_method: "transplant", indoor_start_weeks: 8, growing_notes: "Warm-season. Start early indoors. Shishito, Corbachi are quick producers." },
  { pattern: "radish", days_to_maturity: 25, sow_depth: "1/2 in", plant_spacing: "2-4 in", sun_requirement: "full_sun", soil_temp_min: 45, sow_method: "direct_seed", growing_notes: "Fastest vegetable. Succession sow. French Breakfast, Red Round varieties." },
  { pattern: "spinach", days_to_maturity: 40, sow_depth: "1/2 in", plant_spacing: "4-6 in", sun_requirement: "sun_part_shade", soil_temp_min: 45, sow_method: "direct_seed", growing_notes: "Cool-season. Bolts in heat/long days. Direct sow fall and early spring." },
  { pattern: "squash", days_to_maturity: 50, sow_depth: "1 in", plant_spacing: "24-36 in", sun_requirement: "full_sun", soil_temp_min: 70, sow_method: "both", indoor_start_weeks: 3, growing_notes: "Warm-season. Summer squash harvest young. Edible blossoms, tendrils, leaves." },
  { pattern: "tomato", days_to_maturity: 75, sow_depth: "1/4 in", plant_spacing: "24-36 in", sun_requirement: "full_sun", soil_temp_min: 70, sow_method: "transplant", indoor_start_weeks: 6, growing_notes: "Warm-season. Start indoors 6-8 weeks early. Stake/cage. Sungold, Cherry, Heirloom." },
  { pattern: "tomatillo", days_to_maturity: 70, sow_depth: "1/4 in", plant_spacing: "24-36 in", sun_requirement: "full_sun", soil_temp_min: 70, sow_method: "transplant", indoor_start_weeks: 6, growing_notes: "Warm-season. Plant 2+ for pollination. Harvest when husk splits." },
  { pattern: "turnip", days_to_maturity: 35, sow_depth: "1/4 in", plant_spacing: "4-6 in", sun_requirement: "full_sun", soil_temp_min: 50, sow_method: "direct_seed", growing_notes: "Cool-season. Hakurei is fast (35 days). Edible roots and greens." },

  // MICROS & SHOOTS
  { pattern: "sunflower, sprout", days_to_maturity: 10, sow_depth: "1/4 in", plant_spacing: "dense", sun_requirement: "sun_part_shade", sow_method: "direct_seed", growing_notes: "Microgreen. 7-10 day harvest. Black oil sunflower seeds. Harvest at cotyledon stage." },
  { pattern: "pea.*tendril", days_to_maturity: 14, sow_depth: "1 in", plant_spacing: "dense", sun_requirement: "sun_part_shade", sow_method: "direct_seed", growing_notes: "Microgreen/shoot. 10-14 day harvest. Dense seeding in trays. Cut and come again possible." },
  { pattern: "fava.*micro|fava.*sprout", days_to_maturity: 12, sow_depth: "1 in", plant_spacing: "dense", sun_requirement: "sun_part_shade", sow_method: "direct_seed", growing_notes: "Microgreen. 10-12 day harvest. Soak seeds overnight. Harvest at first true leaf." },

  // FRUIT
  { pattern: "strawberr", days_to_maturity: 120, sow_depth: "surface", plant_spacing: "12-18 in", sun_requirement: "full_sun", soil_temp_min: 60, sow_method: "transplant", growing_notes: "Perennial. Mara des Bois is everbearing with exceptional flavor. Runners produce new plants." },
  { pattern: "fig", days_to_maturity: 365, plant_spacing: "10-15 ft", sun_requirement: "full_sun", sow_method: "transplant", growing_notes: "Deciduous tree/shrub. Edible leaves and fruit. Green (unripe) figs are culinary ingredient." },
  { pattern: "blackberr", days_to_maturity: 365, plant_spacing: "4-6 ft", sun_requirement: "full_sun", sow_method: "transplant", growing_notes: "Perennial cane fruit. Train on wire. Prune spent canes after harvest." },
  { pattern: "raspberr", days_to_maturity: 365, plant_spacing: "2-3 ft", sun_requirement: "full_sun", sow_method: "transplant", growing_notes: "Perennial cane fruit. Golden varieties. Everbearing types fruit on first-year canes." },

  // WILDS & FORAGED
  { pattern: "oxalis", days_to_maturity: null, sun_requirement: "part_shade", growing_notes: "Wild/foraged. Wood sorrel family. Tart lemony flavor. Self-propagating ground cover." },
  { pattern: "chickweed", days_to_maturity: 30, sun_requirement: "part_shade", sow_method: "direct_seed", growing_notes: "Cool-season weed. Self-seeds abundantly. Harvest tips. Mild flavor." },
  { pattern: "miners lettuce", days_to_maturity: 40, sun_requirement: "part_shade", sow_method: "direct_seed", growing_notes: "Native California green. Cool-season. Spade and cup-shaped leaves. Self-seeds." },
  { pattern: "spicebush", days_to_maturity: null, sun_requirement: "part_shade", growing_notes: "Native shrub. Aromatic leaves and berries. Allspice-like flavor. Great for syrups." },
];

async function run() {
  const { data: items } = await admin.from("items").select("id, name, days_to_maturity");

  let updated = 0;
  for (const item of items) {
    // Skip items that already have growing data
    if (item.days_to_maturity != null) continue;

    const name = item.name.toLowerCase();
    for (const gd of GROWING_DATA) {
      const regex = new RegExp(gd.pattern, "i");
      if (regex.test(name)) {
        const updates = {};
        if (gd.days_to_maturity != null) updates.days_to_maturity = gd.days_to_maturity;
        if (gd.sow_depth) updates.sow_depth = gd.sow_depth;
        if (gd.plant_spacing) updates.plant_spacing = gd.plant_spacing;
        if (gd.row_spacing) updates.row_spacing = gd.row_spacing;
        if (gd.sun_requirement) updates.sun_requirement = gd.sun_requirement;
        if (gd.soil_temp_min) updates.soil_temp_min = gd.soil_temp_min;
        if (gd.sow_method) updates.sow_method = gd.sow_method;
        if (gd.indoor_start_weeks) updates.indoor_start_weeks = gd.indoor_start_weeks;
        if (gd.growing_notes) updates.growing_notes = gd.growing_notes;
        updates.growing_zone = "9b";

        if (Object.keys(updates).length > 0) {
          await admin.from("items").update(updates).eq("id", item.id);
          updated++;
        }
        break; // First match wins
      }
    }
  }

  console.log("Items updated with growing data:", updated);

  const { data: withData } = await admin.from("items").select("id").not("days_to_maturity", "is", null);
  console.log("Total items with growing data:", withData?.length);
}

run().catch(console.error);
