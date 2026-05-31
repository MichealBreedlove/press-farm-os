/* One-off: build the catalog categorization report as an .xlsx workbook. */
const XLSX = require("xlsx");

const wb = XLSX.utils.book_new();

// ── Sheet 1: Summary ────────────────────────────────────────────────
const summary = [
  ["Press Farm OS — Catalog Categorization Review"],
  ["Generated", "2026-05-31"],
  ["Source", "Live Supabase catalog (items / delivery_items / availability_items)"],
  [],
  ["Bucket", "What it is", "Count", "Risk", "Recommended action"],
  ["1 — Dead duplicates", "Stale (mostly lowercase) copies with no sales history", "~30", "None", "Fold into Title-Case twin & delete"],
  ["2 — Category fixes", "Items with real sales history in the wrong order-form section", "7", "Low", "Move category; parent grouping stays"],
  ["3 — Judgment calls", "Plausibly intentional — need Micheal's read", "7", "—", "Decide case-by-case"],
  [],
  ["Note", "Multi-part plants (Nasturtium leaf/flowers/capers, etc.) are already correctly modeled via parent_item_id grouping — see 'Plant Part Families' tab. No structural work needed; only the data hygiene above."],
  ["Note", "Recategorization moves items between sections on the chef order form and changes report groupings — that's why this is a review, not an auto-applied change."],
];
const ws1 = XLSX.utils.aoa_to_sheet(summary);
ws1["!cols"] = [{ wch: 22 }, { wch: 60 }, { wch: 8 }, { wch: 8 }, { wch: 38 }];
XLSX.utils.book_append_sheet(wb, ws1, "Summary");

// ── Sheet 2: Bucket 1 — Dead duplicates ─────────────────────────────
const b1Header = ["Item", "Current category", "Deliveries", "Avail rows", "Fold into (canonical)", "Note"];
const b1 = [
  ["alyssum", "herbs_leaves", 0, 0, "Alyssum {flowers}", ""],
  ["anise hyssop", "herbs_leaves", 0, 0, "Anise Hyssop {micros_leaves}", ""],
  ["aptenia", "herbs_leaves", 0, 0, "Aptenia {herbs_leaves}", ""],
  ["Bachelor Button", "herbs_leaves", 0, 0, "Bachelor Button {flowers}", ""],
  ["borage", "herbs_leaves", 0, 0, "Borage {micros_leaves}", "Borage{flowers} also empty — collapse to micros anchor"],
  ["calendula", "herbs_leaves", 0, 0, "Calendula {flowers}", ""],
  ["chrysanthemum", "herbs_leaves", 0, 0, "Chrysanthemum {herbs_leaves}", ""],
  ["fava flowers", "herbs_leaves", 0, 0, "Fava Flowers {flowers}", ""],
  ["Fava Leaf", "herbs_leaves", 0, 0, "Fava Leaf {micros_leaves}", ""],
  ["forget-me-nots", "herbs_leaves", 0, 0, "Forget-Me-Nots {flowers}", "two lowercase copies"],
  ["Forget-me-nots", "herbs_leaves", 0, 0, "Forget-Me-Nots {flowers}", ""],
  ["frilly mustard", "herbs_leaves", 0, 0, "Frilly Mustard {micros_leaves}", ""],
  ["gem marigold", "herbs_leaves", 0, 0, "Gem Marigold {flowers}", "verify: leaf vs flower"],
  ["kale", "herbs_leaves", 0, 0, "Kale {herbs_leaves}", ""],
  ["lemon balm", "herbs_leaves", 0, 0, "Lemon Balm {herbs_leaves}", ""],
  ["lettuce", "herbs_leaves", 0, 0, "Lettuce {herbs_leaves}", ""],
  ["miners lettuce", "herbs_leaves", 0, 0, "Miners Lettuce {herbs_leaves}", ""],
  ["mint", "herbs_leaves", 0, 0, "Mint {herbs_leaves}", ""],
  ["mustard", "herbs_leaves", 0, 0, "Mustard {…}", "one of two empty 'mustard' copies"],
  ["Mustard", "herbs_leaves", 0, 0, "Mustard {…}", "empty herbs copy of the anchor"],
  ["New Zealand Spinach", "herbs_leaves", 0, 0, "New Zealand Spinach {fruit_veg}", ""],
  ["Onion Blossoms", "herbs_leaves", 0, 0, "Onion Blossoms {flowers}", ""],
  ["oxalis", "herbs_leaves", 0, 0, "Oxalis {herbs_leaves}", ""],
  ["oxalis flowers", "herbs_leaves", 0, 0, "Oxalis Flowers {flowers}", ""],
  ["pea flowers", "herbs_leaves", 0, 0, "Pea Flowers {flowers}", ""],
  ["pea tendrils", "herbs_leaves", 0, 0, "Pea Tendrils {micros_leaves}", ""],
  ["Peas", "herbs_leaves", 0, 0, "Peas {fruit_veg}", ""],
  ["Pineapple Mint", "family_meal", 0, 0, "Pineapple Mint {herbs_leaves}", ""],
  ["radish", "herbs_leaves", 0, 0, "Radish {flowers}", "two empty lowercase copies"],
  ["radish pods", "herbs_leaves", 0, 0, "Radish Pods {fruit_veg}", ""],
  ["rosemary", "herbs_leaves", 0, 0, "Rosemary {herbs_leaves}", ""],
  ["Salad Mix Large Leaf", "herbs_leaves", 0, 0, "Salad Mix Large Leaf {kits}", ""],
  ["society garlic", "herbs_leaves", 0, 0, "Society Garlic {flowers}", ""],
  ["tatsoi", "herbs_leaves", 0, 0, "Tatsoi {herbs_leaves}", ""],
  ["violas", "herbs_leaves", 0, 0, "Violas {flowers}", ""],
];
const ws2 = XLSX.utils.aoa_to_sheet([b1Header, ...b1]);
ws2["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 11 }, { wch: 10 }, { wch: 32 }, { wch: 42 }];
XLSX.utils.book_append_sheet(wb, ws2, "Bucket 1 — Dead Dups");

// ── Sheet 3: Bucket 2 — Category fixes ──────────────────────────────
const b2Header = ["Item", "Current category", "Suggested category", "Deliveries", "Last delivered", "Why"];
const b2 = [
  ["Mustard", "flowers", "herbs_leaves", 215, "2026-04-06", "Mustard greens — top-selling leaf filed under Flowers"],
  ["Cilantro", "flowers", "herbs_leaves", 37, "2026-05-30", "The herb/leaf (confirm not cilantro flower)"],
  ["Sorrel", "flowers", "herbs_leaves", 20, "2026-05-11", "Leaf crop"],
  ["Thyme", "flowers", "herbs_leaves", 15, "2025-09-01", "Culinary herb"],
  ["Oregano", "flowers", "herbs_leaves", 3, "2025-05-16", "Culinary herb"],
  ["Mustard Flowers", "herbs_leaves", "flowers", 6, "2026-04-06", "Actual flower; 0-use 'flowers' dup also exists → fold"],
  ["Cardoon", "flowers", "fruit_veg", 3, "2025-06-16", "Vegetable"],
];
const ws3 = XLSX.utils.aoa_to_sheet([b2Header, ...b2]);
ws3["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 11 }, { wch: 14 }, { wch: 50 }];
XLSX.utils.book_append_sheet(wb, ws3, "Bucket 2 — Category Fixes");

// ── Sheet 4: Bucket 3 — Judgment calls ──────────────────────────────
const b3Header = ["Item", "Current category", "Deliveries", "Possible move", "Question for Micheal"];
const b3 = [
  ["Squash", "herbs_leaves", 98, "fruit_veg?", "Is this line squash leaves/greens, or the fruit?"],
  ["Ginger", "flowers", 0, "fruit_veg", "Root/rhizome — move out of Flowers?"],
  ["Sea Kale", "flowers", 0, "herbs_leaves / fruit_veg", "Leaf or veg — not a flower"],
  ["Cover Crop", "flowers", 0, "(remove?)", "Looks like a catch-all — does this belong on the menu?"],
  ["Peach", "flowers", 1, "(keep)", "Peach blossom (fine as flower) vs the fruit 'Peaches'"],
  ["Buckwheat", "flowers", 3, "(keep/herbs?)", "Buckwheat flower vs cover-crop green"],
  ["Peppercress", "flowers", 5, "herbs_leaves / micros_leaves", "A cress — leaf, not a flower"],
];
const ws4 = XLSX.utils.aoa_to_sheet([b3Header, ...b3]);
ws4["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 11 }, { wch: 24 }, { wch: 50 }];
XLSX.utils.book_append_sheet(wb, ws4, "Bucket 3 — Judgment Calls");

// ── Sheet 5: Plant Part Families (already modeled correctly) ────────
const famHeader = ["Parent (anchor)", "Parent category", "Parts / children (category)"];
const fam = [
  ["Amaranth", "micros_leaves", "Amaranth Flowers [flowers]"],
  ["Anise Hyssop", "micros_leaves", "Anise Hyssop Flowers [flowers]"],
  ["Basil", "herbs_leaves", "Basil Buds [flowers], Tulsi [herbs_leaves]"],
  ["Beans", "fruit_veg", "Bean Flowers [flowers], Bean Leaf [herbs_leaves]"],
  ["Beets", "fruit_veg", "Beet [micros_leaves]"],
  ["Bok Choy", "fruit_veg", "Choy, Choy Raab, Tatsoi [herbs_leaves]"],
  ["Broccoli", "fruit_veg", "Broccoli Flowers [flowers], Broccoli Rabe [herbs_leaves], Broccoli Sprouting [fruit_veg]"],
  ["Carrots", "fruit_veg", "Carrot Flowers [flowers], Carrots (tops) [micros_leaves]"],
  ["Chives", "micros_leaves", "Chive Blossoms [flowers], Chive Scape, Garlic Chive [herbs_leaves]"],
  ["Cilantro", "flowers→herbs", "Cilantro Leaf [herbs], Cilantro Micro [micros], Coriander [fruit_veg]"],
  ["Citrus", "fruit_veg", "Calamansi, Citrus Leaf, Kumquat Branches [herbs] + many fruits [fruit_veg]"],
  ["Cucamelons", "fruit_veg", "Cucamelon Leaf / Tendril / Tips [micros_leaves]"],
  ["Cucumbers", "fruit_veg", "Cucumber Flowers [flowers], Cucumber Leaf [herbs], Cucumber Tendril [micros]"],
  ["Fava", "herbs_leaves", "Fava-Beans [fruit_veg], Fava Flowers [flowers], Fava Leaf/Sprout [micros], Fava Tips [herbs]"],
  ["Fennel", "micros_leaves", "Fennel Flowers [flowers], Fronds / Seed / Stems [herbs_leaves]"],
  ["Garlic", "fruit_veg", "Garlic Scape [herbs_leaves], Spring Garlic [fruit_veg]"],
  ["Marigold", "flowers", "Gem Marigold [flowers], Marigold Leaf [herbs_leaves]"],
  ["Mustard", "flowers→herbs", "Mizuna [herbs_leaves], Mustard Flowers [flowers]"],
  ["NASTURTIUM", "herbs_leaves", "Nasturtium Flowers [flowers], Nasturtium Capers (seed pods) [fruit_veg]"],
  ["Onion", "fruit_veg", "Onion Blossoms [flowers], Onions [micros], Spring/Torpedo Onion [fruit_veg]"],
  ["Peas", "fruit_veg", "Pea Flowers [flowers], Pea Tendrils / Field Pea Tendrils [micros/herbs]"],
  ["Radish", "fruit_veg", "Radish (flowers) [flowers], Radish Pods, Tiny Radish Pods [fruit_veg], Radish Shoots [micros]"],
  ["Sorrel", "flowers→herbs", "Red Wood Foliage, Sorrels-Burgundy [herbs_leaves]"],
  ["Squash", "fruit_veg", "Baby Squash [fruit_veg], Squash (leaf) [herbs], Squash Blossom [flowers], Squash Tendril [micros], Squash Tip [herbs]"],
  ["Sunflower", "flowers", "Sunflower Sprouts [micros_leaves]"],
  ["Turnip", "fruit_veg", "Turnip-Leaves [herbs_leaves]"],
  ["Yarrow", "flowers", "Yarrow Leaf [herbs_leaves]"],
];
const ws5 = XLSX.utils.aoa_to_sheet([
  ["These crops already group multiple harvested parts via parent_item_id. NASTURTIUM is the model: leaf anchor → flowers → capers."],
  [],
  famHeader,
  ...fam,
]);
ws5["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 80 }];
XLSX.utils.book_append_sheet(wb, ws5, "Plant Part Families");

const out = "/home/user/press-farm-os/Press_Farm_Catalog_Categorization_Review.xlsx";
XLSX.writeFile(wb, out);
console.log("wrote", out);
