import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAIL } from "@/lib/constants";

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
  const workers = Array.from(new Set((labor ?? []).map((l: any) => l.worker_name)));

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

  const subject = `Press Farm Weekly — ${formatDate(start)} to ${formatDate(end)}`;
  const body = [
    `PRESS FARM — WEEKLY DIGEST`,
    `${formatDate(start)} — ${formatDate(end)}`,
    ``,
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
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Also check for configured email in farm_settings
    const { data: settings } = await (admin as any)
      .from("farm_settings")
      .select("value")
      .eq("key", "admin_email")
      .single();

    const toEmail = settings?.value || ADMIN_EMAIL;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Press Farm <orders@pressfarm.app>",
      to: toEmail,
      subject,
      text: body,
    });

    return NextResponse.json({ success: true, subject, to: toEmail });
  } catch (err) {
    console.error("[DIGEST] Failed to send:", err);
    // Return the digest content even if email fails
    return NextResponse.json({ success: false, subject, body, error: String(err) });
  }
}
