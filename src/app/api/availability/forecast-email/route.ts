import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import type { AvailabilityBuckets, AvailabilityEntry } from "@/lib/forecasting";
import { sendAvailabilityForecastEmail } from "@/lib/email";
import type { ForecastEmailSection, ForecastEmailEntry } from "@/emails/availability-forecast";
import { todayPacific } from "@/lib/utils";
import { requireCronSecret } from "@/lib/api-auth";

// Vercel function budget: one Resend call per chef, sequential. The plan
// default (10 s on Hobby) is tight once the list grows; 60 s is allowed on
// every plan.
export const maxDuration = 60;

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
 * this flow). Returns the number of emails that Resend actually accepted —
 * a rejected send counts as failed, not sent.
 */
export async function GET(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
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

  const today = todayPacific();
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

  // One auth listing instead of a getUserById round-trip per chef (the same
  // batched lookup /admin/weekly-update uses). The farm has well under 1,000
  // accounts, so a single page covers everyone.
  const { data: authList, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) {
    console.error("[FORECAST EMAIL] listUsers failed:", listErr);
    return NextResponse.json({ success: false, error: "Could not load chef accounts." }, { status: 502 });
  }
  const emailById = new Map<string, string>();
  for (const u of authList?.users ?? []) {
    if (u.email) emailById.set(u.id, u.email);
  }

  let emailsSent = 0;
  const failed: Array<{ to: string; error: string }> = [];
  const seenEmails = new Set<string>();

  for (const chefProfile of profiles ?? []) {
    const email = emailById.get(chefProfile.id);
    if (!email) continue;
    // A shared chef account can map to multiple restaurants; only one forecast each.
    if (seenEmails.has(email.toLowerCase())) continue;

    const ru = (restaurantUsers ?? []).find((r: any) => r.user_id === chefProfile.id);
    if (!ru) continue;

    const restaurant = (restaurants ?? []).find((r: any) => r.id === ru.restaurant_id);
    if (!restaurant) continue;

    // One attempt per address, whatever the outcome — a rejected send must
    // not be retried under the next restaurant that shares the account.
    seenEmails.add(email.toLowerCase());
    const res = await sendAvailabilityForecastEmail({
      toEmail: email,
      chefName: chefProfile.full_name ?? "Chef",
      restaurantName: restaurant.name,
      asOfDate,
      sections,
    });
    if (res.ok) {
      emailsSent++;
    } else {
      console.error(`[EMAIL] Failed to send availability-forecast to ${email}:`, res.error);
      failed.push({ to: email, error: res.error ?? "send failed" });
    }
  }

  const attempted = emailsSent + failed.length;
  if (attempted > 0 && emailsSent === 0) {
    return NextResponse.json(
      { success: false, emailsSent, emailsFailed: failed.length, failed, asOfDate, error: "Every forecast email was rejected — nothing was sent." },
      { status: 502 },
    );
  }
  return NextResponse.json({
    success: failed.length === 0,
    emailsSent,
    emailsFailed: failed.length,
    asOfDate,
    ...(failed.length > 0 ? { failed, error: `${failed.length} of ${attempted} sends failed` } : {}),
  });
}
