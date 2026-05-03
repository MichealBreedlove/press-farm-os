import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, ANTHROPIC_KEY_MISSING_ERROR } from "@/lib/anthropic/client";
import { ITEM_CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";
import type { ItemCategory } from "@/types";

const VALID_CATEGORIES = ITEM_CATEGORIES.map((c) => c.value);

// JSON Schema for the structured output. Empty strings signal "model
// doesn't know / doesn't apply" so the client can treat them as "skip"
// without dragging null-handling through every form field. days_to_maturity
// returns 0 when unknown for the same reason.
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
        "Approximate days from seed (or transplant) to harvest. Use 0 if unknown or for perennials.",
    },
    sun_requirement: {
      type: "string",
      enum: ["full_sun", "part_shade", "sun_part_shade", "shade", ""],
      description: "Sun requirement; empty string if unknown.",
    },
    sow_method: {
      type: "string",
      enum: ["direct_seed", "transplant", "both", ""],
      description: "Recommended sow method; empty string if unknown.",
    },
    sow_depth: {
      type: "string",
      description:
        "Sowing depth as a short fractional inches phrase (e.g. '1/4 in', 'surface', '1/2 in'). Empty string if unknown.",
    },
    plant_spacing: {
      type: "string",
      description:
        "Spacing between plants in inches (e.g. '6-9 in', '12 in'). Empty string if unknown.",
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

Use the empty string ("") for any text field where you genuinely have nothing useful to say, and 0 for days_to_maturity when it doesn't apply (perennials) or you don't know.

Output JSON matching the schema. Do not add commentary outside the JSON.`;

interface DraftRequest {
  name?: string;
  variety?: string;
  color?: string;
  category?: ItemCategory | string;
  source?: string;
}

/**
 * POST /api/ai/draft-item-content
 *
 * Admin-only. Generates a starter draft of chef notes, growing notes, and
 * growing-condition fields for a new item using Claude Haiku 4.5. The
 * client overlays the result onto only the empty fields of the form, so
 * admin edits are never overwritten.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: DraftRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (body.category && !VALID_CATEGORIES.includes(body.category as ItemCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: ANTHROPIC_KEY_MISSING_ERROR }, { status: 503 });
  }

  const variety = (body.variety ?? "").trim();
  const color = (body.color ?? "").trim();
  const category = body.category as ItemCategory | undefined;
  const source = (body.source ?? "").trim();

  const userMessage = [
    `Item name: ${name}`,
    variety && `Variety: ${variety}`,
    color && `Color: ${color}`,
    category && `Category: ${CATEGORY_LABELS[category] ?? category}`,
    source && `Seed source: ${source}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema",
          schema: OUTPUT_SCHEMA as any,
        },
      },
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json({ error: "Model returned invalid JSON" }, { status: 502 });
    }

    return NextResponse.json({ draft: parsed });
  } catch (err: any) {
    const message = err?.message ?? "AI request failed";
    const status = typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
