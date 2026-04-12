/**
 * Auto-extract variety, size, and color from existing item names.
 * Parses patterns like "Baby Radish, Red Round" → size: Baby, color: Red
 * or "Basil, Large, Purple" → size: Large, color: Purple, variety: (from name)
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// Size keywords
const SIZE_WORDS = {
  "tiny": "Tiny", "baby": "Baby", "small": "Small", "medium": "Medium",
  "large": "Large", "micro": "Micro", "mini": "Mini", "crudite": "Crudite",
  "dwarf": "Tiny",
};

// Color keywords
const COLORS = [
  "red", "green", "purple", "yellow", "white", "black", "pink", "orange",
  "golden", "bronze", "blue", "scarlet", "burgundy", "mixed", "sunset",
  "speckled", "striped",
];

// Known type → variety mappings from common name patterns
const TYPE_VARIETY_PATTERNS = [
  // "Type, Variety" patterns (comma-separated)
  { regex: /^(\w[\w\s]*),\s+(.+)$/, typeIdx: 1, varietyIdx: 2 },
];

async function run() {
  const { data: items } = await admin.from("items")
    .select("id, name, variety, size, color")
    .eq("is_archived", false);

  let updatedVariety = 0, updatedSize = 0, updatedColor = 0;

  for (const item of items) {
    const name = item.name;
    const updates = {};

    // --- Extract SIZE ---
    if (!item.size) {
      const nameLower = name.toLowerCase();
      const foundSizes = [];
      for (const [keyword, label] of Object.entries(SIZE_WORDS)) {
        if (nameLower.includes(keyword)) {
          foundSizes.push(label);
        }
      }
      // Check for count-based sizes: "(50 ct)", "(25 ct)", "(100 ct)"
      const ctMatch = name.match(/\((\d+)\s*ct\)/i);
      if (ctMatch) {
        foundSizes.push(`${ctMatch[1]} ct`);
      }
      // Check for inch sizes: "1-2 inches", "2-3 inches"
      const inchMatch = name.match(/(\d[\d.-]*)\s*inch/i);
      if (inchMatch) {
        foundSizes.push(`${inchMatch[1]} inch`);
      }
      // Size descriptions in name
      if (nameLower.includes("dime")) foundSizes.push("Dime - Nickel");
      if (nameLower.includes("quarter") && !nameLower.includes("headquarter")) foundSizes.push("Quarter");
      if (nameLower.includes("silver dollar")) foundSizes.push("Silver Dollar");
      if (nameLower.includes("palm size") || nameLower.includes("palm leaf")) foundSizes.push("Palm Size");
      if (nameLower.includes("heart leaf")) foundSizes.push("Heart Leaf");
      if (nameLower.includes("pencil eraser")) foundSizes.push("Pencil Eraser");
      if (nameLower.includes("thumbnail")) foundSizes.push("Thumbnail");

      if (foundSizes.length > 0) {
        updates.size = [...new Set(foundSizes)].join(", ");
      }
    }

    // --- Extract COLOR ---
    if (!item.color) {
      const nameLower = name.toLowerCase();
      const foundColors = [];
      for (const color of COLORS) {
        // Match color as a word boundary (not substring of another word)
        const regex = new RegExp(`\\b${color}\\b`, "i");
        if (regex.test(name)) {
          foundColors.push(color.charAt(0).toUpperCase() + color.slice(1));
        }
      }
      if (foundColors.length > 0) {
        updates.color = foundColors.join(", ");
      }
    }

    // --- Extract VARIETY ---
    if (!item.variety) {
      // Split on comma — first part is type, rest could be variety info
      const parts = name.split(",").map(s => s.trim());
      if (parts.length >= 2) {
        // The first part is the type (already the name field)
        // Second part could be variety, size, or descriptor
        let varietyCandidate = parts[1];

        // Remove size words from variety
        for (const sw of Object.keys(SIZE_WORDS)) {
          varietyCandidate = varietyCandidate.replace(new RegExp(`\\b${sw}\\b`, "gi"), "").trim();
        }
        // Remove color words from variety (they go in color field)
        for (const c of COLORS) {
          varietyCandidate = varietyCandidate.replace(new RegExp(`\\b${c}\\b`, "gi"), "").trim();
        }

        // Clean up remaining
        varietyCandidate = varietyCandidate.replace(/^[,\s]+|[,\s]+$/g, "").trim();

        // If there's still something meaningful left, use it as variety
        if (varietyCandidate.length > 1 && !["Flower", "Flowers", "Leaf", "Leaves", "Micro", "Tips", "Sprouts", "Buds", "Mix"].includes(varietyCandidate)) {
          updates.variety = varietyCandidate;
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await admin.from("items").update(updates).eq("id", item.id);
      if (updates.variety) updatedVariety++;
      if (updates.size) updatedSize++;
      if (updates.color) updatedColor++;
    }
  }

  console.log("Updated variety:", updatedVariety);
  console.log("Updated size:", updatedSize);
  console.log("Updated color:", updatedColor);

  // Show samples
  const { data: samples } = await admin.from("items")
    .select("name, variety, size, color")
    .not("variety", "is", null)
    .limit(15);
  console.log("\nSample items with extracted data:");
  for (const s of samples ?? []) {
    console.log(`  ${s.name} → variety: ${s.variety || "—"} | size: ${s.size || "—"} | color: ${s.color || "—"}`);
  }
}

run().catch(console.error);
