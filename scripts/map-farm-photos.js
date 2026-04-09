require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Map farm photo partial names to item names
const MAP = {
  "hakurei": "Baby Hakurei Turnip",
  "sungold": "Tomatoes, Sungold",
  "genovese": "Basil, Large, Green",
  "borage": "Borage",
  "angelica": "Angelica",
  "romanchamo": "Chamomile",
  "bronze": "Fennel, Leaf, Bronze",
  "sorrelmicro": "Sorrel, Greenleaf",
  "helenmt": "Viola (larger - mixed)",
  "tangerine-gem": "Marigold, Gem",
  "queen-sophia": "Marigold, French",
  "jewel": "Nasturtium, Flower",
  "caraflex": "Cabbage, Chineese",
  "springraab": "Broccoli, Rabe",
  "easteregg": "Radish, Misc",
  "choicemix": "Salad Mix - Small Leaf",
  "germanthyme": "Thyme, Flowering",
  "sweetthaibas": "Basil, Large, Green",
  "cutcelmicro": "Celery, Micro",
  "saladburnsalad": "Salad Burnett",
  "kingrichard": "Tri Point Leek",
  "goldiehusk": "Ground Cherries",
  "rover": "Baby Radish, Red Round",
  "premiummix": "Salad Mix - Large Leaf",
  "decicco": "Broccoli, Sprouting",
  "sorbetformula": "Viola (smaller - purple)",
  "trailing": "Nasturtium, Leaf",
  "durangooutback": "Marigold, Puffball",
  "alexandria": "Strawberries Ripe, Mara des Bois",
};

async function run() {
  const { data: items } = await admin.from("items").select("id, name, image_url");
  const byName = {};
  for (const i of items) byName[i.name.toLowerCase().trim()] = i;

  const photos = fs.readdirSync("public/items").filter((f) => f.startsWith("farm-") && f.endsWith(".jpg"));
  let matched = 0;

  for (const photo of photos) {
    // Try to match based on the descriptive part of the filename
    for (const [keyword, itemName] of Object.entries(MAP)) {
      if (photo.includes(keyword)) {
        const item = byName[itemName.toLowerCase().trim()];
        if (item && !item.image_url) {
          await admin.from("items").update({ image_url: "/items/" + photo }).eq("id", item.id);
          matched++;
          break;
        }
      }
    }
  }

  console.log("Farm photos matched:", matched);
  const { data: withImg } = await admin.from("items").select("id").not("image_url", "is", null);
  console.log("Total items with photos:", withImg?.length);
}

run().catch(console.error);
