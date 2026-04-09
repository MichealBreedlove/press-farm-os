require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Manual mapping: photo filename base (no .jpg) -> item name in DB
const MAP = {
  "alyssum-flower": "Alyssum",
  "amaranth-micro": "Amaranth, Micro",
  "amaranthleaf": "Amaranth, Large, Flowers",
  "anise-leaf": "Anise Hyssop",
  "aniseflower": "Anise Hyssop, Flowers",
  "anisehyssop": "Anise Hyssop",
  "aptenia": "Aptenia",
  "bachelorbutton": "Bachelor Buttons",
  "basilaromatto": "Basil, Large, Green",
  "basilpurplegreek": "Basil, Large, Purple",
  "bayleaf": "Bay Leaf",
  "bean-flower": "Bean, Flower",
  "bean-tendril": "Bean, Leaf",
  "borage": "Borage",
  "borageflower": "Borage",
  "brassica-flowers": "Brassica, Flowers",
  "broccoli": "Broccoli, Sprouting",
  "broccoliraab": "Broccoli, Rabe",
  "buckwheatwhite": "Buckwheat",
  "buckwheatleaf": "Buckwheat",
  "calendula": "Calendula",
  "cauliflowersprouting": "Cauliflower, Sprouting",
  "celeryleafcluster": "Celery, Micro",
  "chamomile": "Chamomile",
  "chickweed": "Chickweed",
  "chickweedtips": "Chickweed",
  "chrysanthemum": "Chrysanthemum, Flower",
  "cilantro-micro": "Cilantro, Micro",
  "crudite-squash": "Squash, Crudite Thumbnail to Quarter",
  "cruditepurslane": "Purslane Tips (50 ct)",
  "cucamelontendril": "Cucamelon Tendril (50 ct)",
  "baby-cucamelon": "Cucamelons, Baby (50 ct)",
  "cucumberleaftendril": "Cucumber Leaf (1 in) (50 ct)",
  "dwarf-choy": "Dwarf Choy",
  "favaflower": "Fava, Flowers",
  "favatip": "Fava Tips",
  "fava-tip": "Fava Tips",
  "fennel": "Fennel, Leaf",
  "fennelflower": "Fennel, Flower",
  "french-marigold": "Marigold, French",
  "gem-marigold": "Marigold, Gem",
  "gemmarigold": "Marigold, Gem",
  "gemmarigoldleaf": "Marigold, Leaf",
  "gerkins": "Cucumber, Persian",
  "grape-leaves": "Grape Leaf",
  "grapeleafmeristem": "Grape Leaf",
  "green-walnuts": "Green Walnuts",
  "hakurei-turnips": "Baby Hakurei Turnip",
  "hakureibaby": "Baby Hakurei Turnip",
  "hibiscus-leaf": "Hisbiscus Leaf, Red - 2 inch (50 ct)",
  "hibiscusleaves": "Hisbiscus Leaf, Red - 2 inch (50 ct)",
  "huacatay": "Huacatay (Peruvian Black Mint)",
  "iceplant": "Ice Plant",
  "iceplant-capers": "Iceplant (50 ct)",
  "kale": "Kale, Mix",
  "kale-leaf": "Kale, Mix",
  "lemonverbenaflower": "Verbena, Lemon",
  "lemonverbenatips": "Verbena, Lemon",
  "miners": "Miners Lettuce",
  "minerscups": "Miners Lettuce",
  "mulberriesallstages": "Mulberries, All Stages",
  "mulberry": "Mulberries, Ripe",
  "mustardflower": "Mustard, Flower",
  "mustardmixmicro": "Mustard Mix",
  "nasturtium-flower": "Nasturtium, Flower",
  "nasturtium-flowers": "Nasturtium, Flower",
  "nasturtiumflower": "Nasturtium, Flower",
  "nasturtium-capers": "Nasturtium, Leaf",
  "nasturtiumshoot": "Nasturtium, Leaf",
  "new-potato": "New Potatoes",
  "okraflower": "Okra",
  "oreganoflower": "Oregano, Flowering",
  "floweringoregano": "Oregano, Flowering",
  "oxalis---wild": "Oxalis / Lucky Sorrel",
  "oxalis-leaf": "Oxalis / Lucky Sorrel",
  "oxalis-flower": "Oxalis / Lucky Sorrel",
  "oxheart-carrot": "Carrot, Oxheart",
  "babyoxheart": "Carrot, Oxheart",
  "papalo": "Papalo",
  "pea-flowers": "Pea, Flowers",
  "pea-flower-2": "Pea, Flowers",
  "pea-tendril": "Pea, Tendrils, Calvin",
  "peatendril": "Pea, Tendrils, Calvin",
  "peatendrils": "Pea, Tendrils, Calvin",
  "peanutleaf": "Peanut Leaf (50 ct)",
  "peppercress": "Peppercress",
  "purplestar": "Purple Stardust (50 ct)",
  "purslanemicro": "Purslane Tips (50 ct)",
  "purslanetips": "Purslane Tips (50 ct)",
  "radish-flower": "Radish, Flower",
  "radishflower": "Radish, Flower",
  "rattailradishpod": "Radish, Rat Tail",
  "rattailradish": "Radish, Rat Tail",
  "red-choy": "Dwarf Red Choy",
  "redmizuna": "Red Mizuna",
  "redroundbaby": "Baby Radish, Red Round",
  "redroundcrudite": "Crudite Radish, Red Round",
  "rosepeach": "Peach, Flowers",
  "roses": "Rose Geranium, Flower",
  "shiso": "Shiso, Green",
  "shisotips": "Shiso, Green",
  "spicebush-buds": "Spicebush",
  "spicebushleafflower": "Spicebush Leaf - Hand Size",
  "squash-blossom": "Squash, Blossoms",
  "squash-bud": "Squash, Blossoms",
  "squash-leaf": "Squash, Leaves",
  "squashleaf": "Squash, Leaves",
  "squashshoot": "Squash, Leaves",
  "squashtendril": "Squash Tendril (50 ct)",
  "squash-tendril": "Squash Tendril (50 ct)",
  "squashtip": "Squash Tip (25 ct)",
  "strawberries---mara-des-bois": "Strawberries Ripe, Mara des Bois",
  "sunflowerbud": "Sunflower",
  "sunflowerbuds": "Sunflower",
  "sweetbay": "Sweet Bay",
  "tinydill": "Dill",
  "tinygrapeleaves": "Grape Leaf",
  "tinypeppercress": "Peppercress",
  "tinysaladburnet": "Salad Burnett",
  "viola---helen-mount": "Viola (larger - mixed)",
  "viola---lg": "Viola (larger - mixed)",
  "viola": "Viola (smaller - purple)",
  "yellowviola": "Viola (larger - mixed)",
  "sunsetviola": "Viola (smaller - purple)",
  "watercress": "Cress, Wild",
  "wild-calendula": "Calendula",
  "wildcalendulaflower": "Calendula",
  "golden-raspberries": "Raspberries, Golden Ripe",
  "greenrasp": "Raspberries, Green",
  "currant-tomatoes": "Tomatoes, Currant",
  "babycucumber": "Cucumber",
  "burgundysorrel": "Sorrel. Red Veined",
  "butterflysorrel": "Sorrels - Butterfly",
  "mixedsorrels": "Sorrels - mixed colors",
  "sorrelclusters": "Sorrel, Greenleaf",
  "malabar-tendril": "Malabar Tendril (50 ct)",
  "malabar-micro": "Malabar Tendril (50 ct)",
  "green-acorn-squash": "Squash, Green Acorn",
  "greenacorn": "Squash, Green Acorn",
  "fbbaby": "Baby Radish, French Breakfast",
  "fbcrudite": "Crudite Radish, French Breakfast",
  "floweringmarj": "Marjoram (Purple)",
  "marjoramflower": "Marjoram (Purple)",
  "sunkissed-oregano": "Oregano",
  "sunkissedherbs": "Oregano",
  "winterquashleaf": "Squash, Leaves",
  "winterSquashleaf": "Squash, Leaves",
  "carrottopsicro": "Carrot, Tops",
  "carrottop micro": "Carrot, Tops",
  "tinychrysanthemum": "Chrysanthemum, Flower",
  "dill": "Dill",
  "dianthus": "Dianthus",
  "deadnettle": "Deadnettle",
  "floweringbuckwheat": "Buckwheat",
  "floweringchickweed": "Chickweed",
  "frenchsorrel": "French Sorrel",
  "chive-blossoms": "Society Garlic",
  "floweringradish": "Radish, Flower",
  "floweringradishtop": "Radish, Flower",
  "frisee": "Lettuce, Salanova",
  "babyfennel": "Fennel, Leaf",
  "tinybronzefennel": "Fennel, Leaf, Bronze",
  "carrottopmicro": "Carrot, Tops",
};

async function run() {
  const { data: items } = await admin.from("items").select("id, name, image_url");
  const byName = {};
  for (const item of items) byName[item.name.toLowerCase().trim()] = item;

  const photos = fs.readdirSync("public/items").filter((f) => f.endsWith(".jpg"));
  let matched = 0;
  const used = new Set();

  for (const photo of photos) {
    const base = photo.replace(".jpg", "");
    const mapName = MAP[base];
    if (!mapName) continue;

    const item = byName[mapName.toLowerCase().trim()];
    if (!item) {
      console.log("MAP entry not in DB:", base, "->", mapName);
      continue;
    }

    // Don't overwrite if already set
    if (item.image_url && used.has(item.id)) continue;

    const url = "/items/" + photo;
    await admin.from("items").update({ image_url: url }).eq("id", item.id);
    used.add(item.id);
    matched++;
  }

  console.log("Photos mapped to items:", matched);

  const { data: withImg } = await admin
    .from("items")
    .select("id")
    .not("image_url", "is", null);
  console.log("Total items with photos:", withImg?.length);
}

run().catch(console.error);
