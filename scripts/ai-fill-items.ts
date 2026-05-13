/**
 * Bulk AI fill for the items catalog.
 *
 * Mirrors POST /api/ai/draft-item-content but runs over every active item
 * and writes the result back to Supabase. Only fills fields that are
 * currently null/empty — never overwrites manual edits.
 *
 * Run:
 *   npx tsx scripts/ai-fill-items.ts --dry-run     # preview 3 items, no writes
 *   npx tsx scripts/ai-fill-items.ts                # full run
 *   npx tsx scripts/ai-fill-items.ts --limit 10     # cap items processed
 *   npx tsx scripts/ai-fill-items.ts --resume-from "Tomato"   # alphabetical resume
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import path from "path";
import { config } from "dotenv";

const envPaths = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "../../../.env.local"),
  path.resolve(process.cwd(), "../../.env.local"),
];
for (const envPath of envPaths) {
  const result = config({ path: envPath });
  if (!result.error) {
    console.log(`Loaded env from: ${envPath}`);
    break;
  }
}

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!ANTHROPIC_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY });

// ────────────────────────────────────────────────────────────────────
// Same prompt + schema as src/app/api/ai/draft-item-content/route.ts
// Keep these in sync if the route's prompt evolves.
// ────────────────────────────────────────────────────────────────────

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    chef_notes: {
      type: "string",
      description:
        "One short sentence aimed at a working chef ordering this item: flavor, texture, ideal use. Empty string if nothing useful to say.",
    },
    growing_notes: {
      type: "string",
      description:
        "Two or three sentences on cultivation specifics relevant to a small organic operation: harvest timing, succession potential, common pitfalls. Empty string if not applicable.",
    },
    season_note: {
      type: "string",
      description:
        "Expected availability in Yountville, CA (USDA zone 9b, Mediterranean climate). Examples: 'Peak in late summer', 'Cool-season crop, spring + fall'. Empty string if not applicable.",
    },
    days_to_maturity: {
      type: "integer",
      description:
        "Approximate days from sow (or transplant) to first harvest. Always provide a best-estimate value: typical numbers are 21-35 for microgreens, 45-75 for lettuces and quick herbs, 60-90 for most leafy greens, 90-150 for fruiting vegetables, 70-120 for cut flowers. For perennial herbs and flowers (rosemary, thyme, lavender, perennial flowers), use the days to first usable harvest from a transplant — 60-90 is typical. Use 0 ONLY for kits and non-plant catalog items.",
    },
    sun_requirement: {
      type: "string",
      enum: ["full_sun", "part_shade", "sun_part_shade", "shade", ""],
      description:
        "Sun requirement. Always pick the best fit for the crop — most edible plants are full_sun, leafy greens and lettuces in summer benefit from sun_part_shade, woodland herbs (sorrel, ramps, mint) prefer part_shade. Use empty string ONLY for kits and non-plant catalog items.",
    },
    sow_method: {
      type: "string",
      enum: ["direct_seed", "transplant", "both", ""],
      description:
        "Recommended sow method for a small organic farm. Always pick the best fit: direct_seed for root crops and many quick greens, transplant for fruiting crops (tomato, pepper, eggplant) and most flowers, both when either works. Use empty string ONLY for kits and non-plant catalog items.",
    },
    sow_depth: {
      type: "string",
      description:
        "Sowing depth as a short phrase. Always provide a best estimate: 'surface' for tiny seeds (lettuce, basil, most flowers), '1/4 in' for small seeds, '1/2 in' for medium seeds, '1 in' for beans/peas/squash, '2 in' for garlic. Use empty string ONLY for kits and non-plant catalog items.",
    },
    plant_spacing: {
      type: "string",
      description:
        "In-row spacing between plants. Always provide a best estimate: '2-4 in' for microgreens densely sown, '6-9 in' for lettuces and bunching greens, '12 in' for most herbs, '18-24 in' for medium fruiting crops, '24-36 in' for large crops (tomato, squash, sunflower). Use empty string ONLY for kits and non-plant catalog items.",
    },
  },
  required: [
    "chef_notes",
    "growing_notes",
    "season_note",
    "days_to_maturity",
    "sun_requirement",
    "sow_method",
    "sow_depth",
    "plant_spacing",
  ],
} as const;

const SYSTEM_PROMPT = `You are a horticulture expert helping a small organic farm in Yountville, California (Napa Valley, Mediterranean climate, USDA zone 9b). The farm grows produce, herbs, flowers, and microgreens for high-end restaurants in the area.

Given basic information about an item the farm grows, generate concise descriptions and growing parameters. Be specific to varieties when you know them. Restrained, knowledgeable tone — no marketing language, no superlatives, no "delightful" or "vibrant".

Calibrate growing values to Johnny's Selected Seeds standards (johnnyseeds.com Growers Library) — that's the farm's reference catalog. Use the typical values Johnny's publishes for the crop and variety: days to maturity, in-row spacing, sow depth, sun preference, and direct-seed vs. transplant recommendation. When Johnny's gives a range (e.g. "55-70 days"), pick the midpoint or the value most appropriate for a Napa Valley climate.

ALWAYS fill in every growing-condition field (days_to_maturity, sun_requirement, sow_method, sow_depth, plant_spacing) with your best estimate. These fields exist so the farmer doesn't have to look them up — leaving them empty defeats the point. If you're uncertain about a specific variety, give the typical value for that crop family. The only time to leave growing-condition fields empty is for non-plant catalog items like kits or assemblies.

For chef_notes / growing_notes / season_note, you may use the empty string ("") if you genuinely have nothing useful to add — but try to provide something for plant items.

Output JSON matching the schema. Do not add commentary outside the JSON.`;

// Category labels mirror src/lib/constants.ts CATEGORY_LABELS
const CATEGORY_LABELS: Record<string, string> = {
  flowers: "Flowers",
  micros_leaves: "Microgreens & Leaves",
  herbs_leaves: "Herbs & Leaves",
  fruit_veg: "Fruit & Vegetables",
  kits: "Kits",
  family_meal: "Family Meal",
};

interface Item {
  id: string;
  name: string;
  category: string;
  variety: string | null;
  color: string | null;
  source: string | null;
  is_archived: boolean;
  chef_notes: string | null;
  growing_notes: string | null;
  season_note: string | null;
  days_to_maturity: number | null;
  sun_requirement: string | null;
  sow_method: string | null;
  sow_depth: string | null;
  plant_spacing: string | null;
}

const FIELDS = [
  "chef_notes",
  "growing_notes",
  "season_note",
  "days_to_maturity",
  "sun_requirement",
  "sow_method",
  "sow_depth",
  "plant_spacing",
] as const;

type FieldName = (typeof FIELDS)[number];

function isEmpty(value: unknown, field: FieldName): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (field === "days_to_maturity" && typeof value === "number") return value === 0;
  return false;
}

interface DraftResult {
  chef_notes: string;
  growing_notes: string;
  season_note: string;
  days_to_maturity: number;
  sun_requirement: string;
  sow_method: string;
  sow_depth: string;
  plant_spacing: string;
}

async function draftItem(item: Item): Promise<DraftResult> {
  const userMessage = [
    `Item name: ${item.name}`,
    item.variety && `Variety: ${item.variety}`,
    item.color && `Color: ${item.color}`,
    item.category && `Category: ${CATEGORY_LABELS[item.category] ?? item.category}`,
    item.source && `Seed source: ${item.source}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: {
      format: {
        type: "json_schema",
        schema: OUTPUT_SCHEMA as any,
      },
    } as any,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b: any) => b.type === "text") as any;
  if (!textBlock) throw new Error("Empty response from model");
  return JSON.parse(textBlock.text) as DraftResult;
}

function buildUpdate(item: Item, draft: DraftResult): Record<string, unknown> {
  const update: Record<string, unknown> = {};
  for (const f of FIELDS) {
    if (!isEmpty(item[f], f)) continue; // preserve existing
    const v = draft[f];
    if (v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue; // model said skip
    if (f === "days_to_maturity" && v === 0) continue;
    update[f] = v;
  }
  return update;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { dryRun: false, limit: Infinity, resumeFrom: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--limit") args.limit = parseInt(argv[++i], 10);
    else if (a === "--resume-from") args.resumeFrom = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs();
  console.log(`Mode: ${args.dryRun ? "DRY RUN (no writes)" : "LIVE"}`);

  const { data: items, error } = await supabase
    .from("items")
    .select(
      "id, name, category, variety, color, source, is_archived, chef_notes, growing_notes, season_note, days_to_maturity, sun_requirement, sow_method, sow_depth, plant_spacing"
    )
    .eq("is_archived", false)
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to load items:", error);
    process.exit(1);
  }

  const all = (items as Item[]) ?? [];
  const startIdx = args.resumeFrom
    ? all.findIndex((i) => i.name.localeCompare(args.resumeFrom) >= 0)
    : 0;
  const fromResume = startIdx === -1 ? [] : all.slice(startIdx);

  const needsFill = fromResume.filter((it) =>
    FIELDS.some((f) => isEmpty(it[f], f))
  );

  console.log(`Active items: ${all.length}`);
  console.log(`Already complete (skipped): ${fromResume.length - needsFill.length}`);
  console.log(`Needs fill: ${needsFill.length}`);

  const work = needsFill.slice(0, args.limit);
  if (args.dryRun) {
    const sample = work.slice(0, 3);
    console.log(`\nDry-run sample of ${sample.length}:`);
    for (const item of sample) {
      const draft = await draftItem(item);
      const update = buildUpdate(item, draft);
      console.log(`\n— ${item.name} (${item.category})`);
      console.log("  Existing:", {
        chef_notes: item.chef_notes,
        growing_notes: item.growing_notes ? `${item.growing_notes.slice(0, 60)}…` : null,
        days_to_maturity: item.days_to_maturity,
        sun_requirement: item.sun_requirement,
      });
      console.log("  Would write:", update);
    }
    console.log("\nDry run complete. Re-run without --dry-run to write.");
    return;
  }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ name: string; error: string }> = [];
  const startedAt = Date.now();

  for (const item of work) {
    processed++;
    try {
      const draft = await draftItem(item);
      const update = buildUpdate(item, draft);
      if (Object.keys(update).length === 0) {
        skipped++;
        console.log(`[${processed}/${work.length}] SKIP ${item.name} (model returned no usable fields)`);
        continue;
      }
      const { error: upErr } = await supabase
        .from("items")
        .update(update)
        .eq("id", item.id);
      if (upErr) throw upErr;
      updated++;
      const fields = Object.keys(update).join(", ");
      console.log(`[${processed}/${work.length}] OK   ${item.name} → ${fields}`);
    } catch (err: any) {
      failed++;
      const msg = err?.message ?? String(err);
      failures.push({ name: item.name, error: msg });
      console.error(`[${processed}/${work.length}] FAIL ${item.name}: ${msg}`);
    }
    // Light pacing — Anthropic Tier-1 limits are generous for Haiku, but be polite.
    await new Promise((r) => setTimeout(r, 250));
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000);
  console.log(`\nDone in ${elapsed}s — processed ${processed}, updated ${updated}, skipped ${skipped}, failed ${failed}`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  ${f.name}: ${f.error}`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
