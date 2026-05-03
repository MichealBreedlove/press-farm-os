import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient, ANTHROPIC_KEY_MISSING_ERROR } from "@/lib/anthropic/client";

// Vercel function timeout — Opus 4.7 with adaptive thinking can take 30-50s
// for strategic analysis of a year of farm data, so we lift the default 10s
// limit. Requires Vercel Pro tier or higher.
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an experienced market gardener and agricultural advisor for Press Farm, a small organic farm in Yountville, California (Napa Valley, USDA zone 9b, Mediterranean climate). The farm grows produce, herbs, flowers, and microgreens for high-end Napa restaurants — primarily Press and Under-Study — plus a Press Bar cocktail program and seasonal events work.

You'll receive a summary of:
1. The last 12 months of restaurant deliveries (what sold, in what quantity, for what revenue, to which restaurants)
2. The last 12 months of farm expenses by category
3. The current season's plantings
4. The active catalog size

Generate strategic recommendations for the upcoming growing season. Be concrete and cite real numbers from the data — never speak in generalities. Group recommendations into these markdown sections, in this order:

## Plant more of
Items with strong restaurant demand that are under-planted or absent from current plantings.

## Plant less of (or skip)
Items consuming bed space without proportional return, or items with low demand relative to the plantings already in the ground.

## Worth trialing
Gaps in the catalog you'd suggest filling based on what the restaurants have been ordering — adjacent crops, varieties, or value-adds.

## Cost watch
Expense categories worth scrutinizing — outsized spend, opportunities for in-house substitutes, or vendor consolidation.

Constraints:
- Use restrained, knowledgeable tone. No hedging, no "delightful", no marketing language.
- Cite specific dollar amounts and item names from the data — recommendations without numbers are useless.
- Each bullet is one or two sentences, not a paragraph.
- Total output under 700 words.
- If the data is too thin in some category to make a real recommendation, say so plainly in that section rather than padding.
- Format strictly: \`## Heading\` followed by \`- bullet\` lines. Plain text only — no \`**bold**\`, no \`*italic*\`, no inline backticks, no nested lists.`;

interface DeliveryRow {
  quantity: number;
  line_total: number;
  unit?: string | null;
  items: { id: string; name: string; category: string; parent_item_id: string | null } | null;
  deliveries: { delivery_date: string; restaurant_id: string; restaurants: { name: string } | null } | null;
}

interface AggregatedItem {
  name: string;
  category: string;
  totalQty: number;
  totalRevenue: number;
  restaurantNames: Set<string>;
  deliveryCount: number;
}

/**
 * POST /api/ai/crop-recommendations
 *
 * Admin-only. Pulls the last 12 months of deliveries, expenses, and the
 * current crop plan; summarizes them; sends the summary to Claude Opus
 * 4.7 with adaptive thinking for strategic recommendations on what to
 * plant next season. Returns the model's markdown response.
 */
export async function POST(_request: Request) {
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

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: ANTHROPIC_KEY_MISSING_ERROR }, { status: 503 });
  }

  const admin = createAdminClient();

  // Resolve the single farm row — Press Farm is a single-tenant install
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId = farms?.[0]?.id;
  if (!farmId) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(today.getFullYear() - 1);
  const startDate = oneYearAgo.toISOString().split("T")[0];
  const endDate = today.toISOString().split("T")[0];

  // Pull delivery_items + items + deliveries via nested selects. Filter the
  // join with !inner so the date range applies — without !inner Supabase
  // returns delivery_items whose parent delivery is outside the window.
  const { data: deliveryRowsRaw } = await (admin as any)
    .from("delivery_items")
    .select(
      "quantity, line_total, unit, items(id, name, category, parent_item_id), deliveries!inner(delivery_date, restaurant_id, restaurants(name))",
    )
    .gte("deliveries.delivery_date", startDate)
    .lte("deliveries.delivery_date", endDate);

  const deliveryRows = (deliveryRowsRaw ?? []) as DeliveryRow[];

  const itemMap = new Map<string, AggregatedItem>();
  let totalRevenue = 0;
  let totalDeliveryLineCount = 0;
  for (const row of deliveryRows) {
    if (!row.items) continue;
    const key = row.items.id;
    const existing = itemMap.get(key);
    const lineTotal = Number(row.line_total ?? 0);
    const qty = Number(row.quantity ?? 0);
    totalRevenue += lineTotal;
    totalDeliveryLineCount += 1;
    if (existing) {
      existing.totalQty += qty;
      existing.totalRevenue += lineTotal;
      existing.deliveryCount += 1;
      const rname = row.deliveries?.restaurants?.name;
      if (rname) existing.restaurantNames.add(rname);
    } else {
      itemMap.set(key, {
        name: row.items.name,
        category: row.items.category,
        totalQty: qty,
        totalRevenue: lineTotal,
        restaurantNames: new Set(row.deliveries?.restaurants?.name ? [row.deliveries.restaurants.name] : []),
        deliveryCount: 1,
      });
    }
  }

  const itemsByRevenue = [...itemMap.values()].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const top30 = itemsByRevenue.slice(0, 30);
  const bottom15 = itemsByRevenue.slice(-15).reverse();

  // Expenses by category — sum amount per category over the last 12 months
  const { data: expenseRows } = await (admin as any)
    .from("farm_expenses")
    .select("category, amount, vendor")
    .eq("farm_id", farmId)
    .gte("date", startDate)
    .lte("date", endDate);

  const expenseTotals = new Map<string, { total: number; topVendors: Map<string, number> }>();
  let totalExpenses = 0;
  for (const e of (expenseRows ?? []) as Array<{ category: string; amount: number; vendor: string | null }>) {
    const cat = (e.category || "Uncategorized").trim();
    const amt = Number(e.amount ?? 0);
    totalExpenses += amt;
    const bucket = expenseTotals.get(cat) ?? { total: 0, topVendors: new Map() };
    bucket.total += amt;
    if (e.vendor) {
      bucket.topVendors.set(e.vendor, (bucket.topVendors.get(e.vendor) ?? 0) + amt);
    }
    expenseTotals.set(cat, bucket);
  }
  const expensesByCategory = [...expenseTotals.entries()]
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 12)
    .map(([category, bucket]) => ({
      category,
      total: bucket.total,
      topVendor:
        [...bucket.topVendors.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? null,
    }));

  // Current plantings — group by status; capture top revenue projections
  const { data: plantingRows } = await (admin as any)
    .from("plantings")
    .select("crop_name, variety, category, status, beds, bed_feet, projected_revenue, season")
    .eq("farm_id", farmId);

  const plantingsByStatus: Record<string, number> = {};
  let totalProjected = 0;
  let totalBedFeet = 0;
  const plantings = (plantingRows ?? []) as Array<{
    crop_name: string;
    variety: string | null;
    category: string;
    status: string;
    beds: number | null;
    bed_feet: number | null;
    projected_revenue: number | null;
    season: number;
  }>;
  for (const p of plantings) {
    plantingsByStatus[p.status] = (plantingsByStatus[p.status] ?? 0) + 1;
    totalProjected += Number(p.projected_revenue ?? 0);
    totalBedFeet += Number(p.bed_feet ?? 0);
  }
  const topPlantings = [...plantings]
    .sort((a, b) => Number(b.projected_revenue ?? 0) - Number(a.projected_revenue ?? 0))
    .slice(0, 20)
    .map((p) => ({
      crop: p.variety ? `${p.crop_name} (${p.variety})` : p.crop_name,
      category: p.category,
      status: p.status,
      bed_feet: p.bed_feet,
      projected_revenue: p.projected_revenue,
    }));

  // Active catalog size by category — gives the model a sense of what
  // crops the farm already has set up to grow vs what would be net-new.
  const { data: itemRows } = await (admin as any)
    .from("items")
    .select("category")
    .eq("farm_id", farmId)
    .eq("is_archived", false);
  const catalogByCategory: Record<string, number> = {};
  for (const it of (itemRows ?? []) as Array<{ category: string }>) {
    catalogByCategory[it.category] = (catalogByCategory[it.category] ?? 0) + 1;
  }

  // Compose a compact JSON summary for the model. Keep it under ~5K tokens.
  const summary = {
    window: { start: startDate, end: endDate, days: 365 },
    totals: {
      total_revenue: round(totalRevenue),
      total_expenses: round(totalExpenses),
      gross_margin: round(totalRevenue - totalExpenses),
      delivery_line_count: totalDeliveryLineCount,
      unique_items_sold: itemMap.size,
    },
    catalog_size_by_category: catalogByCategory,
    top_30_items_by_revenue: top30.map(formatItem),
    bottom_15_items_by_revenue: bottom15.map(formatItem),
    expenses_by_category: expensesByCategory.map((e) => ({
      category: e.category,
      total: round(e.total),
      top_vendor: e.topVendor,
    })),
    current_plantings: {
      counts_by_status: plantingsByStatus,
      total_projected_revenue: round(totalProjected),
      total_bed_feet: totalBedFeet,
      top_20_by_projected_revenue: topPlantings.map((p) => ({
        ...p,
        projected_revenue: round(Number(p.projected_revenue ?? 0)),
      })),
    },
  };

  const userMessage = `Here is Press Farm's last 12 months of operating data. Generate the recommendations as instructed.

\`\`\`json
${JSON.stringify(summary, null, 2)}
\`\`\``;

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const message = await stream.finalMessage();

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }

    return NextResponse.json({
      recommendations: textBlock.text,
      generated_at: new Date().toISOString(),
      window: summary.window,
      totals: summary.totals,
    });
  } catch (err: any) {
    const message = err?.message ?? "AI request failed";
    const status = typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatItem(i: AggregatedItem) {
  return {
    name: i.name,
    category: i.category,
    total_qty: round(i.totalQty),
    total_revenue: round(i.totalRevenue),
    delivery_count: i.deliveryCount,
    restaurants: [...i.restaurantNames],
  };
}
