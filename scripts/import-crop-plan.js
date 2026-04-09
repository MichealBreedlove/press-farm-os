require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Micheal's seasonal crop plan from his spreadsheet
const PLAN = {
  early_winter: {
    micro: ["Celery/Lovage", "Nasturtium", "Wasabi Arugula", "Pea", "Fava"],
    flowers: ["Mustard Flowers", "Alyssum", "Viola", "Chrysanthemum"],
    leaf: ["Bittergreens", "Sugarloaf Conical Chicory", "Frisee", "Chrysanthemum", "Cover Crop", "Fennel Leaf", "Lettuces - Butterhead, Gem", "Mustard Greens", "Peppercorn", "Sorrels", "Swiss Chard", "Wild Greens", "Iceplant", "Kale", "Kohlrabi", "Lettuces - Mini Butterhead, Gem", "Mizuna", "Mustard Greens", "Nasturtium", "Peppercorn", "Spigariello", "Spinach", "Swiss Chard", "Cutting Celery"],
    brassicas: ["Choy", "Collards", "Broccoli", "Kale", "Mizuna", "Kohlrabi"],
    roots: ["Daikon", "Horseradish", "Oil Seed Radish", "Turnip-Gold Ball", "Baby Leeks", "Large Carrots"],
  },
  late_winter: {
    micro: ["Celery/Lovage", "Choys", "Fava", "Kale", "Marigold Gem", "Mustard", "Nasturtium", "Pea", "Wasabi Arugula", "Watercress"],
    flowers: ["Alyssum", "Broccoli (White)", "Celery (Pink)", "Chickweed", "Miners Lettuce", "Mustard (Preserve)", "Oxalis", "Rosemary", "Stone Fruit", "Wild Calendula"],
    leaf: ["Bay Laurel", "Bittergreens (Feb outgoing)", "Broccoli/Mixed Raab", "Chrysanthemum", "Cilantro", "Cover Crop (Fava, Pea, Vetch)", "Cutting Celery", "Fennel Leaf", "Field Salad Mix", "Horseradish Sprout", "Iceplant", "Kale", "Kohlrabi", "Lettuces", "Mizuna", "Mustard Greens", "Nasturtium", "Peppercorn", "Sorrels", "Spigariello", "Spinach", "Swiss Chard", "Wild Greens"],
    roots: ["Baby Leeks", "Carrots", "Celeriac", "Cilantro", "Daikon - White, Mixed Colors", "Hakurei Turnip", "Negi", "Radish", "Wild Onions"],
    fruit: ["Meyer Lemon", "Navel Orange"],
    wilds: ["Bay Laurel - Leaf, Flower, Bud", "CA Bay - Leaf, Flower, Bud", "Chickweed", "Eucalyptus", "Miners Lettuce", "Pink Peppercorn", "Wild Chamomile - Leaf", "Wood Sorrel"],
  },
  early_spring: {
    micro: ["Celery/Lovage", "Choys", "Fava", "Kale", "Marigold Gem", "Mustard", "Nasturtium", "Pea", "Wasabi Arugula", "Watercress"],
    flowers: ["Alyssum", "Borage", "Chickweed (March)", "Chive Buds", "Chrysanthemum", "Cress", "Fava", "Mustard (Preserve)", "Pea", "Pineapple Weed", "Radish", "Stone Fruit", "Viola", "Wasabi Arugula", "Wild Onion"],
    leaf: ["Baby Fennel Bulb", "Broccoli/Mixed Raabs", "Chrysanthemum", "Cilantro", "Collard Raabs", "Cover Crop", "Fennel Leaf", "Lettuces - Gem, Mini Butterhead", "Orach", "Peppercorn", "Sorrels", "Sea Kale Forced", "Spinach", "Succulents", "Swiss Chard"],
    roots: ["Carrots", "Green Garlic", "Hakurei Turnip", "Hinona Kabu", "Leeks (outgoing)", "Negi", "Pearl Onions", "Radish"],
    fruit: ["Artichoke", "Fava Beans - Tiny"],
    wilds: ["Bay Laurel - Leaf, Flower, Bud", "CA Bay - Leaf, Flower, Bud", "Eucalyptus", "Pink Peppercorn", "Wild Chamomile - Flower", "Wild Onion Flowers", "Pine/Fir Tips", "Green Almond"],
  },
  late_spring: {
    micro: ["Amaranth", "Anise Hyssop", "Basil", "Celery", "Cover Crop", "Gem Marigold", "Lambs Quarter", "Nasturtium", "Purslane", "Shiso", "Sunflower", "Tiny Pearl Onions", "Wasabi Arugula"],
    flowers: ["Bachelor Buttons (May)", "Bean (May)", "Borage", "Carrot", "Chamomile", "Chive, common", "Cilantro", "Citrus", "Marigolds (May)", "Mustard Flowers", "Nasturtium", "Pea (April)", "Radish", "Rose", "Sorrel (Cultivated)", "Sunflower (flowers/buds) (June)", "Thyme", "Wild Onion (April only)"],
    leaf: ["Artichoke", "Asparagus - Tiny (May)", "Baby Fennel Bulb", "Basil (May) Leaf", "Broccoli/Mixed Raabs", "Cabbage - Conical/Savoy (May)", "Cardoon", "Cauliflower - Sprouting", "Cherry Leaf", "Chrysanthemum", "Citrus - Young Tips", "Fennel Leaf", "Field Salad Mix", "Fig", "Kohlrabi", "Lettuces - Gem, Butterhead", "Nasturtium", "Peach Leaf", "Peppercorn", "Purslane", "Rhubarb", "Sorrels", "Succulents", "Lemon Balm (outgoing)"],
    roots: ["Beets - Golden (May)", "Carrots - Round", "Carrots", "Green Garlic (outgoing)", "Hinona Kabu (April)", "Large Hakurei", "Pearl Onions", "Radish", "Round Carrots (May)", "Spring onions", "French Shallots"],
    fruit: ["Fava Beans", "Green Currants", "Green Seeds - Coriander, Sea Kale", "Iceplant Capers", "Nasturtium Capers", "Nasturtium Pods", "Peas (April only)", "Peppercorns", "Radish Pods - Purple, Rattail", "Strawberries", "Wild Onion Capers"],
    wilds: ["Conifer Tips", "Grape Leaves", "Green Peppercorns", "Peppercorn Leaf", "Spicebush Leaf", "Elder Flower", "Cherry Plums - Unripe (may)"],
  },
  early_summer: {
    micro: ["Amaranth", "Basil", "Buckwheat", "Cover Crop", "Gem Marigold", "Lambs Quarter", "Malabar", "Nasturtium", "Purslane", "Shiso", "Sun-Kissed Herbs", "Sunflower Sprouts"],
    flowers: ["Alyssum - Mixed Colors", "Anise", "Bachelor Button", "Bean", "Borage", "Brassica Flowers", "Buckwheat", "Caraway", "Carrot", "Chrysanthemum (lots)", "Cilantro", "Cucumber", "Daylilies", "Fennel", "Marigolds", "Mint Flowers", "Rose - Magenta, Peach white", "Sorrel", "Spicebush", "Squash Blossoms", "Sunflower, Buds & Flowers"],
    leaf: ["Amaranth", "Anise Hyssop", "Basil - Greek, Opal, Italian, Tulsi, Thai", "Bean Leaf/Tendril", "Butterfly Sorrel", "Chrysanthemum", "Cucumber Leaves/Tendrils", "Eucalyptus", "Fig Leaf", "Gogonome - Eggplant", "Gem Marigold", "Grape Leaves", "Hibiscus (Mid June)", "Iceberg Lettuce", "Iceplant Capers", "Lemon Balm (outgoing)", "Lemon Verbena", "Lettuce (outgoing)", "Malabar Spinach", "Ornamental Kale Leaf/Raab", "Peach Leaf", "Peppercorn", "Purslane", "Rhubarb", "Shiso: Bulk, Tips, Wrapping", "Squash Leaf/Tendril", "Succulents", "Swiss Chard", "Tomato Leaf"],
    roots: ["Hakurei", "Hinona Kabu", "Radishes", "Spring Onions, Shallot, Cippolini, Pearl"],
    fruit: ["Beans - Romano, Haricot Vert, Long", "Beans Tiny", "Cucumber Tiny with Blossom", "Fava Beans - Full Size (last harvest)", "Golden Raspberries (incoming)", "Green Figs", "Green Raspberries", "Green Seeds: Coriander, Dill, Anise, Caraway", "Ground Cherries", "Mulberries", "Nasturtium Capers", "Radish Pods", "Squash Tiny", "Strawberries, Green/Ripe", "Summer Sq.", "Tomatillos (incoming)", "Tomatoes - Green"],
    wilds: ["Fennel - Leaf/Flower", "Peppercorn Leaf", "Elderflower", "Cherry Plums", "Rose Hips", "Spicebush - Flowers, Buds, Wrapping Leaves", "Preservation", "Chrysanthemum for tea", "Angelica", "Lovage", "Green Tomatoes", "Green Strawberries", "Nasturtium Capers", "Radish Pods", "Green Seeds", "Feijoa Flowers", "Spice Bush Leaf/Flowers", "Roses", "Nasturtium Flowers"],
  },
  summer: {
    micro: ["Amaranth", "Basil", "Cover Crop", "Gem Marigold", "Lambs Quarter", "Nasturtium", "Purslane", "Sun-Kissed Herbs", "Sunflower", "Malabar"],
    flowers: ["Cilantro", "Lemon Verbena", "Marigolds", "Daylilies", "Squash Blossoms", "Bean", "Cucumber", "Sunflower, Buds & Flowers", "Garlic Chive", "Okra"],
    leaf: ["Amaranth", "Basil", "Chrysanthemum", "Cucumber Leaf/Tendril", "Eucalyptus", "Fig Leaf", "Gem Marigold", "Hibiscus", "Lemon Verbena", "Malabar", "Peach Leaf", "Purslane", "Rhubarb (juicing)", "Shiso", "Succulents", "Sweet Potato Leaf", "Swiss Chard"],
    roots: ["Carrots", "Hakurei Turnip", "Radish"],
    fruit: ["Beans", "Cherry Tomatoes", "Cucumbers", "Eggplant", "Green Coriander", "Green Figs", "Ground Cherries", "Mulberries", "Peppers - Nardello", "Radish Pods", "Raspberries - Gold", "Strawberries", "Summer Squash", "Tomatillos", "Tomatoes - Heirloom"],
    wilds: ["Peppercorn", "Spicebush leaf", "Cherry Plums"],
  },
  late_summer: {
    micro: ["Gem Marigold", "Sunflower (on and off)", "Purslane", "Malabar", "Shiso", "Nasturtium"],
    flowers: ["Basil", "Bean", "Chive, Garlic", "Cucumber", "Daylilies (outgoing)", "Lemon Verbena", "Marigolds", "Squash Blossoms (outgoing)"],
    leaf: ["Fig Leaf", "Succulents", "Purslane", "Peppercorn", "Hibiscus", "Shiso", "Malabar", "Spicy Greens", "Large Brassica", "Swiss Chard", "Chinese Cabbage (incoming)", "Wrapping: Cabbage, Bittergreen, Chard"],
    brassicas: ["Collards", "Kale", "Stem Broccoli (incoming)", "Broccoli", "Choy"],
    roots: ["Hinona Kabu", "Large Hakurei", "Radishes", "Oil Seed Radish"],
    fruit: ["Beans", "Figs", "Hibiscus Calyx", "Summer Squash", "Strawberries", "Cucumbers", "Eggplant", "Peppers", "Tomatoes", "Tomatillos", "Fresh Prunes", "Asian Pears", "Apples - Gravenstein, Red Delicious"],
  },
  early_fall: {
    micro: ["Gem Marigold", "Sunflower", "Purslane", "Nasturtium", "Fava", "Pea", "Fennel", "Celery", "Lovage", "Mustard"],
    flowers: ["Sunflowers (preserved)", "Marigolds (preserved)"],
    leaf: ["Succulents", "Hibiscus", "Wrapping: Cabbage, Bittergreen, Lettuce", "Mustard Greens", "Swiss Chard", "Large Leaf Spinach", "Purslane"],
    brassicas: ["Collards", "Kale", "Broccoli", "Stem Broccoli", "Choy", "Kohlrabi", "Cauliflower - Sprouting"],
    roots: ["Daikon", "Radishes", "Oil Seed Radish", "Large Hakurei", "Pink Turnips - Large", "Baby Leeks"],
    fruit: ["Green Tomatoes", "Tomatoes (preserved)", "Cal Bay Nuts", "Hibiscus Calyx", "Prunes (Preserved)", "Asian Pears (Preserved)", "Feijoa (late Oct)", "Peppers (preserved)", "Quince", "Beans (Preserved)"],
  },
  late_fall: {
    micro: ["Wasabi Arugula", "Borage", "Choy", "Chrysanthemum", "Fava", "Pea", "Fennel", "Celery", "Lovage", "Mustard", "Carrot"],
    flowers: ["Radish", "Fava", "Fennel", "Broccoli"],
    leaf: ["Succulents", "Hibiscus (outgoing)", "Chinese Cabbage (heading)", "Wrapping", "Swiss Chard", "Large leaf spinach", "Bittergreens", "Cabbage", "Mustard Greens", "Nasturtium", "Sorrels", "Peppercorn Leaf", "Arugula"],
    brassicas: ["Collards", "Kale", "Stem Broccoli", "Broccoli", "Kohlrabi"],
    roots: ["Baby Leeks", "Nap Onion", "Daikon", "Radishes", "Oil Seed Radish", "Large Hakurei", "Pink Turnips - Large", "Baby Leeks", "Horseradish", "Oxheart Carrots", "GB Turnips"],
    fruit: ["Green Tomatoes", "Winter Squash", "Radish Pods", "Peppers (preserved)", "Crab Apples", "Persimmons"],
  },
};

async function main() {
  const { data: farms } = await admin.from("farms").select("id").limit(1);
  const farmId = farms[0].id;

  // Clear existing entries
  await admin.from("crop_plan_entries").delete().eq("farm_id", farmId);
  console.log("Cleared existing entries");

  let count = 0;
  const batch = [];

  for (const [season, categories] of Object.entries(PLAN)) {
    for (const [category, items] of Object.entries(categories)) {
      for (const itemName of items) {
        batch.push({
          farm_id: farmId,
          item_name: itemName,
          category,
          season,
        });
        count++;
      }
    }
  }

  // Insert in batches of 100
  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);
    const { error } = await admin.from("crop_plan_entries").insert(chunk);
    if (error) console.error("Batch error at", i, ":", error.message);
    else process.stdout.write(".");
  }

  console.log("\nImported", count, "crop plan entries");
}

main().catch(console.error);
