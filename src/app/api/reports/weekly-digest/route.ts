import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/constants";
import { getAnthropicClient } from "@/lib/anthropic/client";
import WeeklyDigest from "@/emails/weekly-digest";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function formatDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

/**
 * GET /api/reports/weekly-digest — Vercel Cron trigger
 * POST /api/reports/weekly-digest — Manual trigger from dashboard
 *
 * Summarizes: deliveries, revenue, expenses, labor for the past 7 days.
 */
export async function GET(request: Request) {
  // Vercel Cron sends authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return sendDigest();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return sendDigest();
}

async function sendDigest() {

  const admin = createAdminClient();

  // Date range: last 7 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 7);
  const start = startDate.toISOString().split("T")[0];
  const end = endDate.toISOString().split("T")[0];

  // Fetch deliveries
  const { data: deliveries } = await (admin as any)
    .from("deliveries")
    .select("delivery_date, total_value, restaurants(name)")
    .gte("delivery_date", start)
    .lte("delivery_date", end)
    .order("delivery_date", { ascending: true });

  // Fetch expenses
  const { data: expenses } = await (admin as any)
    .from("farm_expenses")
    .select("amount, category, description")
    .gte("date", start)
    .lte("date", end);

  // Fetch labor
  const { data: labor } = await (admin as any)
    .from("labor_entries")
    .select("worker_name, hours, hourly_rate")
    .gte("date", start)
    .lte("date", end);

  // Fetch top delivered items
  const { data: topItems } = await (admin as any)
    .from("delivery_items")
    .select("quantity, unit_price, items(name)")
    .in("delivery_id", (deliveries ?? []).map((d: any) => d.id).filter(Boolean));

  // Calculate totals
  const totalRevenue = (deliveries ?? []).reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);
  const totalExpenses = (expenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
  const totalLaborHours = (labor ?? []).reduce((s: number, l: any) => s + (l.hours ?? 0), 0);
  const totalLaborCost = (labor ?? []).reduce((s: number, l: any) => s + (l.hours * (l.hourly_rate ?? 0)), 0);
  const deliveryCount = (deliveries ?? []).length;
  const workers: string[] = Array.from(new Set((labor ?? []).map((l: any) => l.worker_name as string)));

  // Build email
  const deliveryLines = (deliveries ?? []).map((d: any) =>
    `  ${formatDate(d.delivery_date)} — ${d.restaurants?.name ?? "?"} — ${formatCurrency(d.total_value ?? 0)}`
  ).join("\n");

  const expenseLines = (expenses ?? []).map((e: any) =>
    `  ${e.category}: ${formatCurrency(e.amount)}${e.description ? ` (${e.description})` : ""}`
  ).join("\n");

  const laborLines = workers.map((w: string) => {
    const hrs = (labor ?? []).filter((l: any) => l.worker_name === w).reduce((s: number, l: any) => s + l.hours, 0);
    return `  ${w}: ${hrs}h`;
  }).join("\n");

  // AI-generated intro paragraph. Falls back to empty string on any
  // failure (missing key, API error, malformed response) so the digest
  // never breaks because of AI. Skipped when there's no activity at all
  // — nothing to summarize.
  let aiIntro = "";
  if (deliveryCount > 0 || (expenses ?? []).length > 0 || (labor ?? []).length > 0) {
    aiIntro = await draftDigestIntro({
      start,
      end,
      totalRevenue,
      totalExpenses,
      totalLaborHours,
      totalLaborCost,
      deliveryCount,
      deliveries: deliveries ?? [],
      expenses: expenses ?? [],
    });
  }

  const subject = `Press Farm Weekly — ${formatDate(start)} to ${formatDate(end)}`;

  // Plain-text fallback (Resend renders this alongside the React Email HTML so
  // clients that strip styling still get a readable email).
  const fallbackText = [
    `PRESS FARM — WEEKLY DIGEST`,
    `${formatDate(start)} — ${formatDate(end)}`,
    ``,
    ...(aiIntro ? [aiIntro, ``] : []),
    `=== SUMMARY ===`,
    `Revenue: ${formatCurrency(totalRevenue)} (${deliveryCount} deliveries)`,
    `Expenses: ${formatCurrency(totalExpenses)}`,
    `Labor: ${totalLaborHours.toFixed(1)}h (${formatCurrency(totalLaborCost)})`,
    `Net: ${formatCurrency(totalRevenue - totalExpenses - totalLaborCost)}`,
    ``,
    deliveryCount > 0 ? `=== DELIVERIES ===\n${deliveryLines}` : "No deliveries this week.",
    ``,
    (expenses ?? []).length > 0 ? `=== EXPENSES ===\n${expenseLines}` : "No expenses this week.",
    ``,
    workers.length > 0 ? `=== LABOR ===\n${laborLines}` : "No labor logged this week.",
    ``,
    `— Press Farm OS`,
  ].join("\n");

  // Send via Resend
  try {
    const { safeResendSend } = await import("@/lib/resend/client");

    // Also check for configured email in farm_settings
    const { data: settings } = await (admin as any)
      .from("farm_settings")
      .select("value")
      .eq("key", "admin_email")
      .single();

    const toEmail = settings?.value || ADMIN_EMAIL;

    const { FROM_ADDRESSES } = await import("@/lib/constants");
    const reactEl = WeeklyDigest({
      startLabel: formatDate(start),
      endLabel: formatDate(end),
      aiIntro: aiIntro || undefined,
      totalRevenue: formatCurrency(totalRevenue),
      totalExpenses: formatCurrency(totalExpenses),
      totalLaborHours: `${totalLaborHours.toFixed(1)}h`,
      totalLaborCost: formatCurrency(totalLaborCost),
      netLabel: formatCurrency(totalRevenue - totalExpenses - totalLaborCost),
      deliveryCount,
      deliveries: (deliveries ?? []).map((d: any) => ({
        dateLabel: formatDate(d.delivery_date),
        restaurantName: d.restaurants?.name ?? "?",
        value: formatCurrency(d.total_value ?? 0),
      })),
      expenses: (expenses ?? []).map((e: any) => ({
        category: e.category ?? "Uncategorized",
        amount: formatCurrency(e.amount ?? 0),
        description: e.description ?? null,
      })),
      workers: workers.map((w: string) => {
        const hrs = (labor ?? [])
          .filter((l: any) => l.worker_name === w)
          .reduce((s: number, l: any) => s + (l.hours ?? 0), 0);
        return { name: w, hours: `${hrs}h` };
      }),
    }) as React.ReactElement;

    await safeResendSend({
      from: FROM_ADDRESSES.digest,
      to: toEmail,
      subject,
      text: fallbackText,
      react: reactEl,
    });

    return NextResponse.json({ success: true, subject, to: toEmail });
  } catch (err) {
    console.error("[DIGEST] Failed to send:", err);
    // Return the digest content even if email fails
    return NextResponse.json({ success: false, subject, body: fallbackText, error: String(err) });
  }
}

/**
 * Generate a 2-4 sentence intro paragraph for the weekly digest using
 * Claude Haiku 4.5. Returns "" on any failure — missing API key, network
 * error, malformed response — so the digest is never blocked by AI. Cron
 * runs weekly so cost is negligible (~$0.005/week).
 */
async function draftDigestIntro(input: {
  start: string;
  end: string;
  totalRevenue: number;
  totalExpenses: number;
  totalLaborHours: number;
  totalLaborCost: number;
  deliveryCount: number;
  deliveries: Array<{ delivery_date: string; total_value: number; restaurants?: { name: string } | null }>;
  expenses: Array<{ amount: number; category: string; description?: string | null }>;
}): Promise<string> {
  const client = getAnthropicClient();
  if (!client) return "";

  // Compact summary — Haiku doesn't need much context for a 2-4 sentence intro
  const deliverySummary = input.deliveries.map((d) => ({
    date: d.delivery_date,
    restaurant: d.restaurants?.name ?? "?",
    value: Math.round(Number(d.total_value ?? 0)),
  }));
  const expensesByCategory: Record<string, number> = {};
  for (const e of input.expenses) {
    const cat = (e.category || "Uncategorized").trim();
    expensesByCategory[cat] = (expensesByCategory[cat] ?? 0) + Number(e.amount ?? 0);
  }
  const summary = {
    week: { start: input.start, end: input.end },
    totals: {
      revenue: Math.round(input.totalRevenue),
      expenses: Math.round(input.totalExpenses),
      net: Math.round(input.totalRevenue - input.totalExpenses - input.totalLaborCost),
      delivery_count: input.deliveryCount,
      labor_hours: Math.round(input.totalLaborHours * 10) / 10,
      labor_cost: Math.round(input.totalLaborCost),
    },
    deliveries: deliverySummary,
    expenses_by_category: expensesByCategory,
  };

  const SYSTEM = `You are an editorial assistant for Press Farm, a small organic farm in Yountville, California supplying high-end Napa restaurants. You write the lead paragraph for the farm's weekly internal digest email — read by the farmer, not customers.

Write a single paragraph, 2 to 4 sentences. Restrained, factual, editorial tone — no superlatives, no "delightful", no marketing language. Mention specifics that stand out from the data (a strong day, an unusual expense category, a quiet stretch). If the week was unremarkable, say so plainly in one sentence. Do not include a greeting, signature, or "this week we..." preamble. Output only the paragraph text — nothing else.`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Week's data:\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\``,
        },
      ],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return "";
    return textBlock.text.trim();
  } catch (err) {
    console.error("[DIGEST] AI intro failed:", err);
    return "";
  }
}
