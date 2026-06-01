import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import type { AvailabilityBuckets, AvailabilityEntry } from "@/lib/forecasting";
import { sendAvailabilityForecastEmail } from "@/lib/email";
import type { ForecastEmailSection, ForecastEmailEntry } from "@/emails/availability-forecast";

/**
 * Availability Forecast email to chefs.
 *
 *   GET  — Vercel Cron trigger. Requires `Authorization: Bearer ${CRON_SECRET}`.
 *          Fail-closed in production; allow unsigned in local dev (matches the
 *          weekly-digest auth model). Sends to all active chefs.
 *   POST — Manual admin trigger ("Send now" button). Admin role required.
 *
 * Builds horizon buckets for "today" via getAvailabilityBuckets and emails each
 * active chef a forward-looking summary. Recipient resolution mirrors
 * /api/availability/notify (copied, not imported, so changes there can't break
 * this flow). Returns the number of emails sent.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (expected) {
    if (authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed: a production deploy without CRON_SECRET must not be callable.
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  return sendForecastToChefs();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  return sendForecastToChefs();
}

function formatRefDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

/** "opens Jun 4" style label for a future window start; "through Jun 18" for now. */
function windowLabel(entry: AvailabilityEntry, kind: "future" | "now"): string | null {
  const fmt = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (kind === "future" && entry.windowStart) return `opens ${fmt(entry.windowStart)}`;
  if (kind === "now" && entry.windowEnd) return `through ${fmt(entry.windowEnd)}`;
  return null;
}

function toEntry(e: AvailabilityEntry, kind: "future" | "now"): ForecastEmailEntry {
  return {
    name: e.name,
    category: e.category,
    isMicrogreen: e.source === "microgreen",
    estimate: e.estimate ?? null,
    window: windowLabel(e, kind),
  };
}

/**
 * Map the four horizon buckets into the email's section list. Field crops and
 * microgreens are both included; microgreens flagged via `isMicrogreen`.
 * Kept module-local — Next.js route files may only export HTTP handlers and
 * recognized route config, not helper functions.
 */
function bucketsToSections(buckets: AvailabilityBuckets): ForecastEmailSection[] {
  return [
    { title: "Available Now", caption: "Harvesting this week", entries: buckets.now.map((e) => toEntry(e, "now")) },
    { title: "In ~2 Weeks", caption: "Windows opening soon", entries: buckets.in2Weeks.map((e) => toEntry(e, "future")) },
    { title: "In ~4 Weeks", caption: "About a month out", entries: buckets.in4Weeks.map((e) => toEntry(e, "future")) },
    { title: "In ~2 Months", caption: "On the horizon", entries: buckets.in2Months.map((e) => toEntry(e, "future")) },
  ];
}

async function sendForecastToChefs() {
  const admin = createAdminClient();

  const today = new Date().toISOString().slice(0, 10);
  const buckets = await getAvailabilityBuckets(today);
  const sections = bucketsToSections(buckets);
  const asOfDate = formatRefDate(today);

  // Recipient resolution — copied from /api/availability/notify (do not import
  // that route, so changes there can't break this flow).
  const { data: restaurants } = await admin
    .from("restaurants")
    .select("id, name");

  const { data: restaurantUsers } = await admin
    .from("restaurant_users")
    .select("user_id, restaurant_id");

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "chef")
    .eq("is_active", true);

  let emailsSent = 0;
  const seenEmails = new Set<string>();

  for (const chefProfile of profiles ?? []) {
    const { data: authUser } = await admin.auth.admin.getUserById(chefProfile.id);
    const email = authUser?.user?.email;
    if (!email) continue;
    // A shared chef account can map to multiple restaurants; only one forecast each.
    if (seenEmails.has(email.toLowerCase())) continue;

    const ru = (restaurantUsers ?? []).find((r: any) => r.user_id === chefProfile.id);
    if (!ru) continue;

    const restaurant = (restaurants ?? []).find((r: any) => r.id === ru.restaurant_id);
    if (!restaurant) continue;

    try {
      await sendAvailabilityForecastEmail({
        toEmail: email,
        chefName: chefProfile.full_name ?? "Chef",
        restaurantName: restaurant.name,
        asOfDate,
        sections,
      });
      seenEmails.add(email.toLowerCase());
      emailsSent++;
    } catch (err) {
      console.error(`[EMAIL] Failed to send availability-forecast to ${email}:`, err);
    }
  }

  return NextResponse.json({ success: true, emailsSent, asOfDate });
}
