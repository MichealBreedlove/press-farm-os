import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import type { AvailabilityEntry } from "@/lib/forecasting";
import { addDaysISO, todayPacific } from "@/lib/utils";
import type {
  WeeklyUpdateBedRow,
  WeeklyUpdateIncomingGroup,
} from "@/emails/weekly-update";

/**
 * Weekly Update draft assembly + validation, shared by the send route
 * (/api/reports/weekly-update) and the editor page (/admin/weekly-update).
 *
 * The flow: buildWeeklyUpdateData() assembles a draft from live data
 * (planter boxes, forecast, farm tasks). The admin can edit every field of
 * that draft on /admin/weekly-update; the edited draft is persisted as JSON in
 * farm_settings.weekly_update_draft stamped with the week's Monday anchor.
 * Sends prefer a same-week draft over a fresh live build, so what Micheal
 * edited is exactly what goes out.
 */

export interface WeeklyUpdateData {
  /** e.g. "August 10" — rendered as "Week of August 10". */
  weekOfLabel: string;
  generalNote: string;
  planterBeds: WeeklyUpdateBedRow[];
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

/** One row of weekly_update_log — every send attempt, successful or not. */
export interface WeeklyUpdateAttempt {
  weekOf: string;
  triggeredBy: "cron" | "manual";
  status: "sent" | "partial" | "failed" | "skipped";
  source?: "edited" | "draft" | "live" | null;
  recipientsCount?: number;
  succeededCount?: number;
  failedCount?: number;
  error?: string | null;
}

/**
 * Record a send attempt in weekly_update_log.
 *
 * Deliberately swallows its own errors: logging must never be the reason an
 * otherwise-good email fails. A lost log row is recoverable; a throw here
 * would abort the send path. `admin` must be the service-role client.
 */
export async function recordWeeklyUpdateAttempt(
  admin: SupabaseClient,
  attempt: WeeklyUpdateAttempt,
): Promise<void> {
  try {
    await (admin as any).from("weekly_update_log").insert({
      week_of: attempt.weekOf,
      triggered_by: attempt.triggeredBy,
      status: attempt.status,
      source: attempt.source ?? null,
      recipients_count: attempt.recipientsCount ?? 0,
      succeeded_count: attempt.succeededCount ?? 0,
      failed_count: attempt.failedCount ?? 0,
      // A runaway Resend error shouldn't bloat the row — a few KB is plenty
      // to diagnose from.
      error: attempt.error ? attempt.error.slice(0, 4000) : null,
    });
  } catch (err) {
    console.error("[WEEKLY-UPDATE] Failed to write weekly_update_log row:", err);
  }
}

/**
 * Did the update for `weekOf` reach at least one recipient?
 *
 * 'partial' counts as reached — some chefs got it, which is a different and
 * less urgent problem than nobody getting it. The watchdog uses this to
 * decide whether Monday silently missed.
 */
export async function hasSuccessfulWeeklyUpdate(
  admin: SupabaseClient,
  weekOf: string,
): Promise<boolean> {
  const { data, error } = await (admin as any)
    .from("weekly_update_log")
    .select("id")
    .eq("week_of", weekOf)
    .in("status", ["sent", "partial"])
    .limit(1);
  // On a query error, assume it DID send. A watchdog that cries wolf every
  // time the database hiccups gets muted, and a muted watchdog is worse than
  // no watchdog.
  if (error) {
    console.error("[WEEKLY-UPDATE] Watchdog lookup failed:", error);
    return true;
  }
  return (data ?? []).length > 0;
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

/**
 * Planter-box order for the weekly update: ST boxes first, then every other
 * series (G, U, …) — each by its NUMBER, so ST2 comes before ST10.
 */
export function compareBoxNames(a: string, b: string): number {
  const parse = (n: string) => {
    const m = n.trim().match(/^([A-Za-z]*)\s*(\d+)?/);
    return { prefix: (m?.[1] ?? "").toUpperCase(), num: m?.[2] ? Number(m[2]) : Infinity };
  };
  const pa = parse(a);
  const pb = parse(b);
  if (pa.prefix !== pb.prefix) {
    if (pa.prefix === "ST") return -1;
    if (pb.prefix === "ST") return 1;
    return pa.prefix.localeCompare(pb.prefix);
  }
  if (pa.num !== pb.num) return pa.num < pb.num ? -1 : 1;
  return a.localeCompare(b);
}

/** Assemble a fresh draft from live data. `admin` must be the service-role client. */
export async function buildWeeklyUpdateData(admin: SupabaseClient): Promise<WeeklyUpdateData> {
  const today = todayPacific();

  // ---- Forecast buckets (feed the incoming timeline) --------------------
  // The Available Now and Gaps or Limited Supply sections were dropped
  // (Micheal 2026-10-09) — chefs see live availability on the order form.
  const buckets = await getAvailabilityBuckets(today);

  // ---- Restaurant planter beds ------------------------------------------
  const { data: bedRows } = await (admin as any)
    .from("planter_box_plantings")
    .select("name, planted_date, status, planter_boxes(name, is_active)")
    .eq("status", "active");
  const planterBeds: WeeklyUpdateBedRow[] = (bedRows ?? [])
    .filter((r: any) => r.planter_boxes?.is_active !== false)
    .sort(
      (a: any, b: any) =>
        compareBoxNames(a.planter_boxes?.name ?? "", b.planter_boxes?.name ?? "") ||
        (a.name as string).localeCompare(b.name),
    )
    .map((r: any) => ({
      name: r.name,
      bed: r.planter_boxes?.name ?? "—",
      planted: r.planted_date ? shortDate(r.planted_date) : "—",
      // Planting notes are internal (production-value estimates) — never
      // pre-fill them into a chef-facing email. Admin can still type one.
      notes: "",
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

  // Only tasks due WITHIN the update week (Mon-Sun). Older overdue tasks are
  // an internal backlog, not chef news — including them made long-dead items
  // (e.g. July sow jobs) reappear in every live build.
  const { data: openTasks } = await (admin as any)
    .from("farm_tasks")
    .select("title, due_date, status")
    .in("status", ["open", "snoozed"])
    .gte("due_date", weekAnchor)
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
    planterBeds,
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
    // Re-sorted by box number so drafts saved before the ST-first order
    // (alphabetical by planting) still go out in box order.
    planterBeds: rows(r.planterBeds)
      .map((x) => ({ name: str(x.name), bed: str(x.bed), planted: str(x.planted), notes: str(x.notes) }))
      .filter((x) => x.name)
      .sort((a, b) => compareBoxNames(a.bed, b.bed)),
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
