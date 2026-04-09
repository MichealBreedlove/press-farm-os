/**
 * Import the current offer sheet items into the database.
 * Updates prices for existing items, adds new items that don't exist.
 * Maps container descriptions to unit types.
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Map container descriptions to unit_type codes
function mapUnit(desc) {
  if (!desc) return "ea";
  const d = desc.toLowerCase().trim().replace(/^\//, "");
  if (d.includes("small to-go") || d.includes("small to go")) return "sm";
  if (d.includes("large to-go") || d.includes("large to go")) return "lg";
  if (d.includes("quart") || d.includes("in quart")) return "qt";
  if (d.includes("flat")) return "lg"; // flats are large containers
  if (d.includes("lb")) return "lbs";
  if (d.includes("ea")) return "ea";
  return "ea";
}

// Map section headers to categories
function mapCategory(section) {
  if (!section) return "herbs_leaves";
  const s = section.toLowerCase();
  if (s.includes("flower")) return "flowers";
  if (s.includes("micro")) return "micros_leaves";
  if (s.includes("flat")) return "micros_leaves";
  if (s.includes("foraged")) return "herbs_leaves";
  if (s.includes("herb")) return "herbs_leaves";
  if (s.includes("fruit")) return "fruit_veg";
  if (s.includes("root") || s.includes("crudite") || s.includes("baby root")) return "fruit_veg";
  if (s.includes("wrapping") || s.includes("lettuce") || s.includes("leafy") || s.includes("garnish")) return "herbs_leaves";
  if (s.includes("preservation")) return "herbs_leaves";
  return "herbs_leaves";
}

// The offer sheet data
const SECTIONS = [
  {
    section: "Flowers",
    items: [
      ["Alyssum (white)", 12, "/small to-go"],
      ["Arugula, White", 15, "/quart"],
      ["Bachelor Button", 10, "/small to-go"],
      ["Borage", 15, "/small to-go"],
      ["Broccoli - Yellow", 15, "/quart"],
      ["Broccoli - White", 15, "/quart"],
      ["Calendula - Cultivated", 20, "/large to-go"],
      ["Caraway", 12, "/small to-go"],
      ["Celery", 10, "/small to-go"],
      ["Chrysanthemum, Yellow", 15, "/large to-go"],
      ["Fava (100 ct)", 15, "/ea"],
      ["Marigold, Gem (50 ct)", 12, "/ea"],
      ["Mustard Flower - Limited", 15, "/quart"],
      ["Nasturtium - Closed Buds (25 ct)", 15, "/small to-go"],
      ["Nasturtium Flower", 25, "/large to-go"],
      ["Oxalis, Wild - outgoing", 10, "/small to-go"],
      ["Oxalis, Wild - on stem (50 ct)", 12, "/quart"],
      ["Pea (Pink/Purple) (50 ct)", 12, "/ea"],
      ["Peppercress (50 ct)", 12, "/ea"],
      ["Radish", 15, "/quart"],
      ["Sorrel, Small Yellow (100 ct)", 15, "/ea"],
      ["Sorrel, Purple (100 ct)", 15, "/ea"],
      ["Viola - Small (Purple/Yellow)", 15, "/small to-go"],
      ["Viola - Larger (Sunset)", 12, "/small to-go"],
      ["Wasabi Arugula (50 ct)", 12, "/ea"],
      ["Wild Calendula", 15, "/small to-go"],
      ["Wild Onion Flower", 30, "/large to-go"],
    ],
  },
  {
    section: "Micros - Container",
    items: [
      ["Borage (Oyster/Cucumber flavor) (25 ct)", 8, "/ea"],
      ["Bulls Blood Beet", 12, "/small to-go"],
      ["Carrot", 12, "/small to-go"],
      ["Celery, Cutting (50 ct)", 12, "/ea"],
      ["Chervil", 10, "/small to-go"],
      ["Chrysanthemum", 10, "/small to-go"],
      ["Cilantro", 18, "/large to-go"],
      ["Tiny Dill", 15, "/small to-go"],
      ["Fava", 12, "/large to-go"],
      ["Fava Sprout (50 ct)", 12, "/ea"],
      ["Tiny Fennel, Bronze", 15, "/small to-go"],
      ["Tiny Fennel, Green", 15, "/small to-go"],
      ["Kale, Tuscan", 15, "/large to-go"],
      ["Lovage (50 ct)", 12, "/ea"],
      ["Gem Marigold Leaf (50 ct)", 15, "/ea"],
      ["Mustard, Dragons Tongue", 12, "/large to-go"],
      ["Mustard Mix", 12, "/large to-go"],
      ["Orach, Purple", 20, "/large to-go"],
      ["Pea - Frilly", 15, "/large to-go"],
      ["Pea - Regular", 12, "/large to-go"],
      ["Peppercress", 12, "/small to-go"],
      ["Red Mizuna", 12, "/large to-go"],
      ["Shiso, Britton", 15, "/small to-go"],
      ["Sorrel, French (50 ct)", 12, "/ea"],
      ["Sorrel, Red Vein", 15, "/small to-go"],
      ["Sweet Clover (50 ct)", 12, "/ea"],
      ["Swiss Chard", 10, "/small to-go"],
      ["Wasabi Arugula Leaf (1-2 inches)", 12, "/ea"],
      ["Watercress", 10, "/small to-go"],
    ],
  },
  {
    section: "Foraged",
    items: [
      ["California Bay Leaves", 15, "/large to-go"],
      ["Sweet Bay", 10, "/large to-go"],
      ["California Pink Peppercorns", 12, "/large to-go"],
      ["California Peppercorn Leaf", 12, "/large to-go"],
      ["Chickweed Tips (50 ct)", 12, "/ea"],
      ["Miners Lettuce Spades/Cups (50 ct)", 15, "/ea"],
      ["Miners Lettuce Spades, Tiny (50 ct)", 15, "/ea"],
      ["Miners Lettuce Cups, Small (50 ct)", 20, "/ea"],
      ["Miners Lettuce Cups, Large (50 ct)", 20, "/ea"],
      ["Wild Oxalis", 15, "/large to-go"],
      ["Wild Oxalis Stems (flowering) (50 ct)", 12, "/ea"],
      ["Spicebush", 20, "/lb"],
    ],
  },
  {
    section: "Baby Roots",
    items: [
      ["Tiny Onion (50 ct)", 25, "/ea"],
      ["Turnip, Hakurei - Tiny Root (50 ct)", 25, "/ea"],
      ["Radish, Red Round - Tiny Root (50 ct)", 25, "/ea"],
      ["Radish, French Breakfast - Tiny Root (50 ct)", 25, "/ea"],
      ["Baby Hakurei Turnip (50 ct)", 25, "/ea"],
      ["Baby Radish, Red Round (50 ct)", 25, "/ea"],
      ["Baby Radish, French Breakfast (50 ct)", 25, "/ea"],
    ],
  },
  {
    section: "Crudite Roots",
    items: [
      ["Crudite Radish, Red Round (50 ct)", 25, "/ea"],
      ["Crudite Radish, French Breakfast (50 ct)", 25, "/ea"],
      ["Crudite Hakurei Turnip (50 ct)", 25, "/ea"],
    ],
  },
  {
    section: "Herbs",
    items: [
      ["Angelica", 15, "/lb"],
      ["Chrysanthemum", 12, "/large to-go"],
      ["Citrus Leaf", 10, "/large to-go"],
      ["Citrus Leaf Shoots (25 ct)", 10, "/ea"],
      ["Mulberry Leaf (25 ct)", 10, "/ea"],
      ["Fennel Fronds (Green/Bronze)", 10, "/large to-go"],
      ["Fennel Fronds - tighter leaves", 12, "/small to-go"],
      ["French Sorrel", 15, "/lb"],
      ["French Sorrel Stems (25 ct)", 15, "/ea"],
      ["Geranium, Rose", 12, "/large to-go"],
      ["Gem Marigold Leaf (Micro) (50 ct)", 15, "/ea"],
      ["Lemon Balm", 10, "/large to-go"],
      ["Mint Tips, Strawberry (50 ct)", 10, "/ea"],
      ["Mint Tips, Mixed (50 ct)", 10, "/ea"],
      ["Spearmint", 10, "/large to-go"],
      ["Stinging Nettle", 10, "/large to-go"],
      ["Sunkissed Herbs Mix", 20, "/small to-go"],
      ["Rosemary", 10, "/large to-go"],
    ],
  },
  {
    section: "Fruit",
    items: [
      ["Asparagus Shoots (50 ct)", 15, "/ea"],
      ["Tiny Radish Pods (50 ct)", 15, "/ea"],
      ["Radish Pods - Mixed Sizes", 15, "/small to-go"],
      ["Tiny Peas - Yellow/Green (50 ct)", 25, "/ea"],
      ["Fava Beans - Tiny (50 ct)", 20, "/ea"],
      ["Snow/Snap Pea Mix", 15, "/large to-go"],
    ],
  },
  {
    section: "Wrapping/Heart Leaves",
    items: [
      ["Collards - Heart Leaf (50 ct)", 18, "/ea"],
      ["Kale Mix - Heart Leaf (50 ct)", 18, "/ea"],
      ["Kale, Ornamental Leaf, Mixed (50 ct)", 20, "/ea"],
    ],
  },
  {
    section: "Lettuce Cups",
    items: [
      ["Green Gem - Heart Leaf (50 ct)", 20, "/ea"],
      ["Green Gem - Palm Size Leaf (50 ct)", 20, "/ea"],
      ["Green Romaine - Heart Leaf (50 ct)", 20, "/ea"],
      ["Green Romaine - Palm Size Leaf (50 ct)", 20, "/ea"],
      ["Speckled Romaine - Heart Leaf (50 ct)", 20, "/ea"],
      ["Speckled Romaine - Palm Size Leaf (50 ct)", 20, "/ea"],
      ["Red Gem - Heart Leaf (50 ct)", 20, "/ea"],
      ["Red Gem - Palm Size Leaf (50 ct)", 20, "/ea"],
      ["Butterhead Lettuce - Heart Leaf (50 ct)", 20, "/ea"],
      ["Butterhead Lettuce - Palm Size Leaf (50 ct)", 20, "/ea"],
    ],
  },
  {
    section: "Leafy Veg/Broccoli/Raabs",
    items: [
      ["Pea/Fava Greens - Field", 15, "/lb"],
      ["Lettuce, Little Gem, Green", 2, "/ea"],
      ["Lettuce, Little Gem, Red", 2, "/ea"],
      ["Lettuce, Mini Butterhead, Green", 2, "/ea"],
      ["Mixed Raabs (50 ct)", 20, "/ea"],
      ["Sprouting Broccoli, Green (50 ct)", 18, "/ea"],
      ["Sprouting Broccoli, Purple (50 ct)", 18, "/ea"],
      ["Kale, Ornamental Raab, Mixed Colors (50 ct)", 20, "/ea"],
      ["Kale, Ornamental Leaf, Mixed Colors (50 ct)", 20, "/ea"],
      ["Kalettes, Ornamental, Mixed Colors (50 ct)", 20, "/ea"],
    ],
  },
  {
    section: "Garnish Veg",
    items: [
      ["Anise Hyssop Tiny Leaf/Tip (50 ct)", 12, "/ea"],
      ["Cutting Celery (Pink/Green/White)", 8, "/large to-go"],
      ["Tiny Dill", 15, "/small to-go"],
      ["Fava Tip - Field (50 ct)", 20, "/ea"],
      ["Fava Sprout (50 ct)", 12, "/ea"],
      ["Fennel Fronds - tighter leaves", 12, "/small to-go"],
      ["Frilly Red Mustard Leaf - Tiny (50 ct)", 12, "/ea"],
      ["Frilly Red Mustard Leaf (50 ct)", 12, "/ea"],
      ["Nasturtium (Dime-Nickel) (50 ct)", 15, "/ea"],
      ["Nasturtium (Quarter-Silver Dollar) (50 ct)", 15, "/ea"],
      ["Nasturtium (Palm) (50 ct)", 15, "/ea"],
      ["Orach Leaf - Tiny Purple (50 ct)", 12, "/ea"],
      ["Tiny Pea Tendrils (Lamborn) (50 ct)", 12, "/ea"],
      ["Pea Tip/Tendril - Field (50 ct)", 20, "/ea"],
      ["Tiny Sorrels - Mixed (50 ct)", 12, "/ea"],
      ["Tiny Sorrels - Burgundy (50 ct)", 12, "/ea"],
      ["Tiny Sorrels - Yellow (50 ct)", 12, "/ea"],
      ["Turnip Leaf - Tiny (1-2 inches)", 12, "/ea"],
      ["Sorrel, Butterfly", 15, "/large to-go"],
      ["Succulent: Iceplant (50 ct)", 15, "/ea"],
      ["Succulent: Aptenia Plouche (50 ct)", 15, "/ea"],
      ["Succulent: Aptenia Leaf (50 ct)", 15, "/ea"],
      ["Succulent: NZ Spinach - Plouche (50 ct)", 15, "/ea"],
      ["Succulent: NZ Spinach - Leaf (50 ct)", 15, "/ea"],
      ["Succulent: Saltbush Tips (50 ct)", 15, "/ea"],
      ["Sweet Clover (50 ct)", 12, "/ea"],
      ["Wasabi Arugula Leaf - 1-2 inches", 12, "/ea"],
      ["Vetch Tendril (50 ct)", 15, "/ea"],
    ],
  },
];

async function main() {
  const { data: farms } = await admin.from("farms").select("id").limit(1);
  const farmId = farms[0].id;

  const { data: items } = await admin.from("items").select("id, name, default_price, unit_type, category");
  const byName = {};
  for (const i of items) byName[i.name.toLowerCase().trim()] = i;

  let updated = 0;
  let inserted = 0;
  let skipped = 0;

  for (const sec of SECTIONS) {
    const category = mapCategory(sec.section);
    for (const [name, price, unitDesc] of sec.items) {
      const unit = mapUnit(unitDesc);
      const existing = byName[name.toLowerCase().trim()];

      if (existing) {
        // Update price if different
        if (existing.default_price !== price) {
          await admin.from("items").update({ default_price: price }).eq("id", existing.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        // Insert new item
        const { error } = await admin.from("items").insert({
          farm_id: farmId,
          name: name,
          category: category,
          unit_type: unit,
          default_price: price,
          is_archived: false,
          sort_order: 0,
        });
        if (error) {
          console.error("Insert error:", name, error.message);
        } else {
          inserted++;
        }
      }
    }
  }

  console.log("Updated prices:", updated);
  console.log("New items inserted:", inserted);
  console.log("Already correct:", skipped);

  const { count } = await admin.from("items").select("*", { count: "exact", head: true });
  console.log("Total items now:", count);
}

main().catch(console.error);
