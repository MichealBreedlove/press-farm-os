import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import type { AvailabilityEntry } from "@/lib/forecasting";
import { addDaysISO, todayPacific } from "@/lib/utils";
import type {
  WeeklyUpdateAvailRow,
  WeeklyUpdateBedRow,
  WeeklyUpdateGapRow,
  WeeklyUpdateIncomingGroup,
} from "@/emails/weekly-update";

/**
 * Weekly Update draft assembly + validation, shared by the send route
 * (/api/reports/weekly-update) and the editor page (/admin/weekly-update).
 *
 * The flow: buildWeeklyUpdateData() assembles a draft from live data
 * (availability, planter boxes, forecast). The admin can edit every field of
 * that draft on /admin/weekly-update; the edited draft is persisted as JSON in
 * farm_settings.weekly_update_draft stamped with the week's Monday anchor.
 * Sends prefer a same-week draft over a fresh live build, so what Micheal
 * edited is exactly what goes out.
 */

export interface WeeklyUpdateData {
  /** e.g. "August 10" — rendered as "Week of August 10". */
  weekOfLabel: string;
  generalNote: string;
  availableNow: WeeklyUpdateAvailRow[];
  planterBeds: WeeklyUpdateBedRow[];
  gaps: WeeklyUpdateGapRow[];
  incoming: WeeklyUpdateIncomingGroup[];
  /** Farm tasks finished in the last 7 days, one line each. */
  tasksCompleted: string[];
  /** Farm tasks due (or overdue) through the end of the update week. */
  tasksUpcoming: string[];
}

/** Saved-draft envelope stored in farm_settings.weekly_update_draft. */
export interface WeeklyUpdateDraft {
  /** ISO date of the Monday this draft was written for. */
  weekOf: string;
  data: WeeklyUpdateData;
}

/** The upcoming Monday (Pacific) — today when today IS Monday. The email's
 *  "Week of" anchor and the draft/sent-week stamp. */
export function upcomingMondayISO(today: string = todayPacific()): string {
  const dow = new Date(today + "T12:00:00Z").getUTCDay();
  return addDaysISO(today, (1 - dow + 7) % 7);
}

export function weekOfLabelFor(mondayISO: string): string {
  return new Date(mondayISO + "T12:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

function shortDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Assemble a fresh draft from live data. `admin` must be the service-role client. */
export async function buildWeeklyUpdateData(admin: SupabaseClient): Promise<WeeklyUpdateData> {
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

  // ---- Farm tasks: done last 7 days + due through end of update week -----
  const weekAnchor = upcomingMondayISO(today);
  const { data: doneTasks } = await (admin as any)
    .from("farm_tasks")
    .select("title, completed_at")
    .eq("status", "completed")
    .gte("completed_at", addDaysISO(today, -7) + "T00:00:00Z")
    .order("completed_at", { ascending: true })
    .limit(50);
  const tasksCompleted: string[] = (doneTasks ?? []).map((t: any) => {
    const day = t.completed_at
      ? new Date(t.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" })
      : null;
    return day ? `${t.title} (${day})` : t.title;
  });

  const { data: openTasks } = await (admin as any)
    .from("farm_tasks")
    .select("title, due_date, status")
    .in("status", ["open", "snoozed"])
    .lte("due_date", addDaysISO(weekAnchor, 6))
    .order("due_date", { ascending: true })
    .limit(50);
  const tasksUpcoming: string[] = (openTasks ?? []).map((t: any) => {
    const overdue = t.due_date < today;
    return `${t.title} (${overdue ? "overdue — " : "due "}${shortDate(t.due_date)})`;
  });

  // ---- General note ------------------------------------------------------
  const { data: noteRow } = await (admin as any)
    .from("farm_settings")
    .select("value")
    .eq("key", "weekly_update_general_note")
    .maybeSingle();

  return {
    weekOfLabel: weekOfLabelFor(weekAnchor),
    generalNote: noteRow?.value ?? "",
    availableNow,
    planterBeds,
    gaps,
    incoming,
    tasksCompleted,
    tasksUpcoming,
  };
}

const MAX_ROWS = 300;
const str = (v: unknown): string => (typeof v === "string" ? v.slice(0, 2000) : "");

/**
 * Coerce untrusted JSON (a saved draft or an admin-posted edit) into a
 * well-formed WeeklyUpdateData. Returns null if the shape is unusable.
 */
export function sanitizeWeeklyUpdateData(raw: unknown): WeeklyUpdateData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rows = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? (v.slice(0, MAX_ROWS).filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : [];
  return {
    weekOfLabel: str(r.weekOfLabel) || weekOfLabelFor(upcomingMondayISO()),
    generalNote: str(r.generalNote),
    availableNow: rows(r.availableNow)
      .map((x) => ({ name: str(x.name), qty: str(x.qty), size: str(x.size), notes: str(x.notes) }))
      .filter((x) => x.name),
    planterBeds: rows(r.planterBeds)
      .map((x) => ({ name: str(x.name), bed: str(x.bed), planted: str(x.planted), notes: str(x.notes) }))
      .filter((x) => x.name),
    gaps: rows(r.gaps)
      .map((x) => ({ name: str(x.name), lastWeek: str(x.lastWeek), substitute: str(x.substitute), backWhen: str(x.backWhen) }))
      .filter((x) => x.name),
    incoming: rows(r.incoming)
      .map((x) => ({
        label: str(x.label),
        items: Array.isArray(x.items) ? x.items.map(str).filter(Boolean).slice(0, MAX_ROWS) : [],
      }))
      .filter((x) => x.label),
    tasksCompleted: Array.isArray(r.tasksCompleted)
      ? r.tasksCompleted.map(str).filter(Boolean).slice(0, MAX_ROWS)
      : [],
    tasksUpcoming: Array.isArray(r.tasksUpcoming)
      ? r.tasksUpcoming.map(str).filter(Boolean).slice(0, MAX_ROWS)
      : [],
  };
}

/** Parse the stored draft setting; null when absent or malformed. */
export function parseWeeklyUpdateDraft(value: string | null | undefined): WeeklyUpdateDraft | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    const data = sanitizeWeeklyUpdateData(parsed?.data);
    if (!data || typeof parsed?.weekOf !== "string") return null;
    return { weekOf: parsed.weekOf, data };
  } catch {
    return null;
  }
}
