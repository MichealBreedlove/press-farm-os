import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient, ANTHROPIC_KEY_MISSING_ERROR } from "@/lib/anthropic/client";

// Catalog audit on Opus 4.7 with adaptive thinking on ~289 items can take
// 60-90 seconds. Vercel Pro caps at 300s; we set 120 to leave headroom.
export const maxDuration = 120;

const SYSTEM_PROMPT = `You are a catalog hygienist for Press Farm, a small organic farm in Yountville, California (Napa Valley, USDA zone 9b) growing produce, herbs, flowers, and microgreens for high-end restaurants. Their item catalog has accumulated inconsistencies over time — possible near-duplicates, sub-parts of one crop spread across multiple loose entries, slight name variations.

You'll receive the active catalog as a JSON array. Each item has: id, name, category, variety, color, parent_item_id (null if top-level).

Categories used by this catalog:
- flowers — edible flowers and cut flowers
- micros_leaves — microgreens
- herbs_leaves — herbs and leafy herbs
- fruit_veg — produce (vegetables and fruit)
- kits — assemblies, not single crops
- family_meal — staff meal items, not single crops

Parent/child rule (the catalog supports this via parent_item_id):
- Single level only — children cannot themselves have children.
- Children stay in their own category and behave as standalone items on the chef order form.
- The hierarchy is admin organization only.
- A parent crop (e.g. "Squash") groups its sub-parts (Blossoms, Tendrils, Leaves, Fruit) which often span multiple categories.

Calibrate your judgment to Johnny's Selected Seeds standards (johnnyseeds.com Growers Library). When deciding whether two items are "the same crop," check: do they appear under the same Johnny's listing? If yes, they're likely candidates to merge or group. If they're separately listed varieties, they should stay distinct.

Generate a markdown report with EXACTLY these four sections, in this order:

## Likely duplicates
Items that appear to be the same crop with slightly different names — typos, truncations, or accidentally-double-entered items. For each pair or group, name the items, explain the reasoning briefly, and suggest which name to keep as canonical. Do NOT include items that are distinct varieties of the same crop — those belong under "Parent/child groupings" or stay separate.

## Parent/child groupings
Items that are different parts, uses, or growth stages of the same crop and should be linked via parent_item_id. For each grouping: name the proposed parent (note if it needs to be created vs. already exists in the catalog), then list the children. Group children by part — e.g. "Squash → Blossoms (Flowers), Tendrils (Micros), Leaves (Herbs), Fruit (Veg)". Different varieties of the same crop (e.g. Genovese basil and Thai basil) should also go here under a parent of "Basil".

## Already well-structured
A short list confirming groups of items that are correctly distinct or already grouped — three to six examples is plenty. This gives confidence the audit didn't miss obvious things.

## Ambiguous
Items where you can't tell from the name alone whether they're duplicates or distinct varieties. List each with what info would resolve them (e.g. "Without knowing which 'Lettuce' variety this refers to, I can't tell if it duplicates 'Lettuce - Red Oak'").

Format strictly: \`## Heading\` followed by \`- bullet\` lines. Plain text only — no \`**bold**\`, no \`*italic*\`, no inline backticks, no nested lists. Each bullet is one or two sentences.

When you reference items, use their displayed name (not ID). Be specific — name every item involved in a recommendation. Don't just say "several lettuces" — list them.

If a section legitimately has nothing to report, say so plainly in one bullet rather than padding.`;

interface CatalogItem {
  id: string;
  name: string;
  category: string;
  variety: string | null;
  color: string | null;
  parent_item_id: string | null;
}

/**
 * POST /api/ai/catalog-audit
 *
 * Admin-only. Reads the full active catalog and asks Claude Opus 4.7 to
 * suggest near-duplicates to merge and parent/child groupings — calibrated
 * to Johnny's Selected Seeds standards. Returns the model's markdown
 * report. Pure suggestion — applies nothing on its own.
 */
export async function POST(_request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: ANTHROPIC_KEY_MISSING_ERROR }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: itemRows } = await admin
    .from("items")
    .select("id, name, category, variety, color, parent_item_id")
    .eq("is_archived", false)
    .order("category")
    .order("name");

  const items = (itemRows ?? []) as CatalogItem[];
  if (items.length === 0) {
    return NextResponse.json({ error: "Catalog is empty — nothing to audit." }, { status: 400 });
  }

  // Compact catalog payload — use single-letter keys to save tokens. The
  // schema is documented inline so the model knows what each field means.
  const catalog = items.map((i) => ({
    id: i.id,
    n: i.name,
    cat: i.category,
    v: i.variety ?? "",
    c: i.color ?? "",
    p: i.parent_item_id ?? null,
  }));

  const userMessage = `Active catalog (${items.length} items). Field key: n=name, cat=category, v=variety, c=color, p=parent_item_id (null if top-level).

\`\`\`json
${JSON.stringify(catalog)}
\`\`\`

Generate the audit report as instructed.`;

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      // Adaptive thinking on Opus 4.7 can burn 10-25K tokens reasoning
      // through 269 catalog items before it produces any text output.
      // The previous 8K cap left no room for the report itself —
      // request finished max_tokens with thinking only, no text block,
      // surfacing as "Empty response from model" on the page. 32K
      // gives thinking + a full multi-section report plenty of room.
      max_tokens: 32768,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const message = await stream.finalMessage();

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      // Surface what actually came back so the failure mode is debuggable
      // from the UI instead of the server logs — most likely cause is
      // hitting max_tokens during thinking.
      const blockTypes = message.content.map((b) => b.type).join(", ") || "none";
      return NextResponse.json(
        {
          error: `No text in response. stop_reason=${message.stop_reason}, blocks=[${blockTypes}]. Try regenerating; if this persists, raise max_tokens further.`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      report: textBlock.text,
      generated_at: new Date().toISOString(),
      item_count: items.length,
    });
  } catch (err: any) {
    const message = err?.message ?? "AI request failed";
    const status = typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
