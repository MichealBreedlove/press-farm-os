import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import type { AvailabilityEntry } from "@/lib/forecasting";
import { addDaysISO, todayPacific } from "@/lib/utils";
import WeeklyUpdate from "@/emails/weekly-update";
import type {
  WeeklyUpdateAvailRow,
  WeeklyUpdateBedRow,
  WeeklyUpdateGapRow,
  WeeklyUpdateIncomingGroup,
} from "@/emails/weekly-update";

/**
 * Chef-facing "Press Farm – Weekly Update" email.
 *
 *   GET  — Vercel Cron trigger (Monday mornings). Requires
 *          `Authorization: Bearer ${CRON_SECRET}`; fail-closed in production.
 *   POST — Manual admin trigger from /admin/settings/emails.
 *
 * Recipients: ONLY the addresses stored comma-separated in
 * farm_settings.weekly_update_recipients — chosen per-person in
 * /admin/settings/emails (chefs are offered as a picker there but are not
 * auto-included). The "General" section is admin-authored via
 * farm_settings.weekly_update_general_note.
 *
 * Content is assembled from live data:
 *   - Available Now       → latest published availability cycle
 *   - Planter Beds        → active planter_box_plantings
 *   - Gaps / Limited      → limited or newly-dropped availability vs the prior cycle
 *   - Incoming Timeline   → getAvailabilityBuckets horizon buckets
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
  return sendWeeklyUpdate();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;
  return sendWeeklyUpdate();
}

function shortDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function sendWeeklyUpdate() {
  const admin = createAdminClient();
  const today = todayPacific();

  // ---- Availability: current cycle + the one before it -------------------
  // Cycles run Thu/Sat/Mon, so 14 days back always covers the previous cycle,
  // and 7 days forward covers a cycle the admin has published ahead of time.
  const { data: availRows } = await (admin as any)
    .from("availability_items")
    .select(
      "delivery_date, status, limited_qty, cycle_notes, available_sizes, available_units, items(name)",
    )
    .gte("delivery_date", addDaysISO(today, -14))
    .lte("delivery_date", addDaysISO(today, 7));

  const cycleDates: string[] = Array.from(
    new Set<string>((availRows ?? []).map((r: any) => r.delivery_date as string)),
  ).sort();
  const currentCycle = cycleDates[cycleDates.length - 1] ?? null;
  const previousCycle = cycleDates.length > 1 ? cycleDates[cycleDates.length - 2] : null;

  // Dedupe by item name across restaurants; an item available anywhere counts
  // as available, and limited quantities take the largest published cap.
  type CycleItem = {
    name: string;
    status: "available" | "limited" | "unavailable";
    limitedQty: number | null;
    sizes: string;
    notes: string;
  };
  function collapseCycle(date: string | null): Map<string, CycleItem> {
    const map = new Map<string, CycleItem>();
    for (const r of (availRows ?? []).filter((r: any) => r.delivery_date === date)) {
      const name = (r.items?.name ?? "").trim();
      if (!name) continue;
      const prev = map.get(name.toLowerCase());
      const status = r.status as CycleItem["status"];
      const rank = { available: 2, limited: 1, unavailable: 0 } as const;
      if (!prev || rank[status] > rank[prev.status]) {
        map.set(name.toLowerCase(), {
          name,
          status,
          limitedQty: r.limited_qty ?? prev?.limitedQty ?? null,
          sizes: r.available_sizes ?? prev?.sizes ?? "",
          notes: r.cycle_notes ?? prev?.notes ?? "",
        });
      }
    }
    return map;
  }
  const current = collapseCycle(currentCycle);
  const previous = collapseCycle(previousCycle);

  const availableNow: WeeklyUpdateAvailRow[] = Array.from(current.values())
    .filter((i) => i.status !== "unavailable")
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((i) => ({
      name: i.name,
      qty: i.status === "limited" ? (i.limitedQty != null ? `${i.limitedQty} (limited)` : "Limited") : "Open",
      size: i.sizes || "—",
      notes: i.notes || "",
    }));

  // ---- Forecast buckets (also used for "back when" on gaps) --------------
  const buckets = await getAvailabilityBuckets(today);
  const futureEntries: AvailabilityEntry[] = [
    ...buckets.in2Weeks,
    ...buckets.in4Weeks,
    ...buckets.in2Months,
  ];
  function backWhenFor(name: string): string {
    const hit = futureEntries.find((e) => e.name.toLowerCase() === name.toLowerCase());
    return hit ? `~${shortDate(hit.windowStart)}` : "TBD";
  }

  // ---- Gaps: limited this cycle, or available last cycle and gone now ----
  // The availability editor publishes a row for EVERY catalog item each cycle,
  // so most rows sit at 'unavailable' (out of season / never toggled on).
  // Those aren't gaps — an unavailable item only makes the table when it was
  // actually available the previous cycle, i.e. something chefs just lost.
  const gaps: WeeklyUpdateGapRow[] = [];
  for (const i of current.values()) {
    if (i.status === "available") continue;
    const wasAvailable = previous.get(i.name.toLowerCase())?.status === "available";
    if (i.status === "unavailable" && !wasAvailable) continue;
    gaps.push({
      name: i.name,
      lastWeek: wasAvailable ? "Yes" : "No",
      substitute: "—",
      backWhen: i.status === "limited" ? "Now (limited)" : backWhenFor(i.name),
    });
  }
  for (const p of previous.values()) {
    if (p.status !== "available" || current.has(p.name.toLowerCase())) continue;
    gaps.push({ name: p.name, lastWeek: "Yes", substitute: "—", backWhen: backWhenFor(p.name) });
  }
  gaps.sort((a, b) => a.name.localeCompare(b.name));

  // ---- Restaurant planter beds ------------------------------------------
  const { data: bedRows } = await (admin as any)
    .from("planter_box_plantings")
    .select("name, planted_date, notes, status, planter_boxes(name, is_active)")
    .eq("status", "active");
  const planterBeds: WeeklyUpdateBedRow[] = (bedRows ?? [])
    .filter((r: any) => r.planter_boxes?.is_active !== false)
    .sort((a: any, b: any) => (a.name as string).localeCompare(b.name))
    .map((r: any) => ({
      name: r.name,
      bed: r.planter_boxes?.name ?? "—",
      planted: r.planted_date ? shortDate(r.planted_date) : "—",
      notes: r.notes ?? "",
    }));

  // ---- Incoming timeline -------------------------------------------------
  const names = (entries: AvailabilityEntry[]) =>
    Array.from(new Set(entries.map((e) => e.name)));
  const incoming: WeeklyUpdateIncomingGroup[] = [
    { label: "~2 Weeks", items: names(buckets.in2Weeks) },
    { label: "~1 Month", items: names(buckets.in4Weeks) },
    { label: "~2 Months", items: names(buckets.in2Months) },
  ];

  // ---- Settings: general note + extra recipients -------------------------
  const { data: settingRows } = await (admin as any)
    .from("farm_settings")
    .select("key, value")
    .in("key", ["weekly_update_general_note", "weekly_update_recipients"]);
  const settingsMap: Record<string, string> = {};
  for (const row of settingRows ?? []) settingsMap[row.key] = row.value ?? "";

  // ---- Recipients: exactly the saved list, nobody else -------------------
  const recipients = new Set<string>();
  for (const entry of (settingsMap.weekly_update_recipients ?? "").split(",")) {
    const email = entry.trim().toLowerCase();
    if (email) recipients.add(email);
  }
  if (recipients.size === 0) {
    return NextResponse.json({
      success: false,
      skipped: true,
      error: "No recipients configured — pick who gets the update in Settings → Emails.",
    });
  }

  // ---- Build + send ------------------------------------------------------
  const weekOfLabel = new Date(today + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const subject = `Press Farm Weekly Update — Week of ${weekOfLabel}`;

  const fallbackText = [
    `PRESS FARM — WEEKLY UPDATE`,
    `Week of ${weekOfLabel}`,
    ``,
    ...(settingsMap.weekly_update_general_note
      ? [`GENERAL:`, settingsMap.weekly_update_general_note, ``]
      : []),
    `=== AVAILABLE NOW ===`,
    ...(availableNow.length > 0
      ? availableNow.map((r) => `  ${r.name} — ${r.qty}${r.size !== "—" ? ` — ${r.size}` : ""}${r.notes ? ` (${r.notes})` : ""}`)
      : ["  Availability not yet published — check the order form."]),
    ``,
    ...(planterBeds.length > 0
      ? [`=== RESTAURANT PLANTER BEDS ===`, ...planterBeds.map((r) => `  ${r.name} — ${r.bed} — planted ${r.planted}${r.notes ? ` (${r.notes})` : ""}`), ``]
      : []),
    ...(gaps.length > 0
      ? [`=== GAPS OR LIMITED SUPPLY ===`, ...gaps.map((r) => `  ${r.name} — last wk: ${r.lastWeek} — back: ${r.backWhen}`), ``]
      : []),
    `=== ITEMS INCOMING ===`,
    ...incoming.map((g) => `  ${g.label}: ${g.items.length > 0 ? g.items.join(", ") : "—"}`),
    ``,
    `Order at ${process.env.NEXT_PUBLIC_APP_URL ?? "https://pressfarm.io"}/order`,
    `— Press Farm · Yountville, California`,
  ].join("\n");

  const { safeResendSend } = await import("@/lib/resend/client");
  const { FROM_ADDRESSES } = await import("@/lib/constants");
  const reactEl = WeeklyUpdate({
    weekOfLabel,
    generalNote: settingsMap.weekly_update_general_note || null,
    availableNow,
    planterBeds,
    gaps,
    incoming,
  }) as React.ReactElement;

  const list = Array.from(recipients);
  const sendResults = await Promise.allSettled(
    list.map((to) =>
      safeResendSend({
        from: FROM_ADDRESSES.forecast,
        to,
        subject,
        text: fallbackText,
        react: reactEl,
      }).then((res) => {
        if (res.error) throw new Error(res.error.message);
      }),
    ),
  );

  const sent: string[] = [];
  const failed: Array<{ to: string; error: string }> = [];
  sendResults.forEach((r, i) => {
    if (r.status === "fulfilled") sent.push(list[i]);
    else failed.push({ to: list[i], error: String(r.reason) });
  });
  if (failed.length > 0) console.error("[WEEKLY-UPDATE] Some sends failed:", failed);

  return NextResponse.json({
    success: sent.length > 0,
    subject,
    to: sent,
    ...(failed.length > 0
      ? { failed, error: `${failed.length} of ${list.length} sends failed` }
      : {}),
  });
}
