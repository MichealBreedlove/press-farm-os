import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvailabilityBuckets } from "@/lib/forecasting";
import type { AvailabilityEntry } from "@/lib/forecasting";
import { addDaysISO, todayPacific } from "@/lib/utils";
import type { WeeklyUpdateIncomingGroup } from "@/emails/weekly-update";

/**
 * Weekly Update draft assembly + validation, shared by the send route
 * (/api/reports/weekly-update) and the editor page (/admin/weekly-update).
 *
 * The flow: buildWeeklyUpdateData() assembles a draft from live data
 * (forecast, farm tasks). The admin can edit every field of
 * that draft on /admin/weekly-update; the edited draft is persisted as JSON in
 * farm_settings.weekly_update_draft stamped with the week's Monday anchor.
 * Sends prefer a same-week draft over a fresh live build, so what Micheal
 * edited is exactly what goes out.
 */

export interface WeeklyUpdateData {
  /** e.g. "August 10" — rendered as "Week of August 10". */
  weekOfLabel: string;
  generalNote: string;
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
 * Deliberately never throws: logging must never be the reason an
 * otherwise-good email fails. A lost log row is recoverable; a throw here
 * would abort the send path. But it IS reported — supabase-js returns insert
 * failures in `{ error }` rather than throwing, and before 2026-10-27 that
 * value was never read, so a rejected row vanished without a trace and the
 * watchdog later cried "chefs did NOT get the update" over a send that
 * worked. Returns false when the row was not written. `admin` must be the
 * service-role client.
 */
export async function recordWeeklyUpdateAttempt(
  admin: SupabaseClient,
  attempt: WeeklyUpdateAttempt,
): Promise<boolean> {
  try {
    const { error } = await (admin as any).from("weekly_update_log").insert({
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
    if (error) {
      console.error(
        `[WEEKLY-UPDATE] Failed to write weekly_update_log row (${attempt.status}, week of ${attempt.weekOf}):`,
        error,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[WEEKLY-UPDATE] Failed to write weekly_update_log row:", err);
    return false;
  }
}

/**
 * Did the update for `weekOf` reach at least one recipient?
 *
 * Proof is a 'sent' or 'partial' weekly_update_log row for the week
 * ('partial' counts — some chefs got it, which is a different and less
 * urgent problem than nobody getting it).
 *
 * The farm_settings.weekly_update_last_sent_week stamp is deliberately NOT
 * accepted as proof: since 2026-10-27 the send route writes it BEFORE the
 * sends (so an overlapping late-slot run can't re-send), which makes it a
 * claim of intent, not of delivery. A failed log insert is logged loudly by
 * recordWeeklyUpdateAttempt; a false alarm from that is the safer failure.
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

// ---- farm_settings helpers (generic: the digest's sent-week stamp uses them too) ----

/** Read a handful of farm_settings keys into a map (missing keys are absent). */
export async function readFarmSettings(
  admin: SupabaseClient,
  keys: string[],
): Promise<Record<string, string>> {
  const { data, error } = await admin.from("farm_settings").select("key, value").in("key", keys);
  if (error) {
    console.error("[FARM-SETTINGS] read failed:", error);
    return {};
  }
  const out: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{ key: string; value: string | null }>) out[row.key] = row.value ?? "";
  return out;
}

/**
 * Upsert one farm_settings key (null clears it). Resolves the single farm's
 * id itself. Returns false — and logs — when the write did not happen; it
 * never throws, since a stamp must not take a send down with it.
 */
export async function upsertFarmSetting(
  admin: SupabaseClient,
  key: string,
  value: string | null,
): Promise<boolean> {
  try {
    const { data: farmRow, error: farmErr } = await admin.from("farms").select("id").limit(1).maybeSingle();
    if (farmErr || !farmRow?.id) {
      console.error(`[FARM-SETTINGS] no farm row for ${key}:`, farmErr);
      return false;
    }
    const { error } = await admin
      .from("farm_settings")
      .upsert({ farm_id: farmRow.id, key, value }, { onConflict: "farm_id,key" });
    if (error) {
      console.error(`[FARM-SETTINGS] upsert ${key} failed:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[FARM-SETTINGS] upsert ${key} threw:`, err);
    return false;
  }
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
 * Planter-box display order: ST boxes first, then every other
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
    incoming,
    tasksCompleted,
    tasksUpcoming,
  };
}

const MAX_ROWS = 300;
const str = (v: unknown, max = 2000): string => (typeof v === "string" ? v.slice(0, max) : "");
// The general note is a full multi-section write-up (status, crop-by-crop,
// property…) — 2,000 chars silently cut real notes mid-line (2026-10-26).
const MAX_NOTE_CHARS = 20000;

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
    generalNote: str(r.generalNote, MAX_NOTE_CHARS),
    // planterBeds was removed 2026-10-11 (moves to the order sheet) — drafts
    // saved before then still carry it; it is dropped here so it never sends.
    incoming: rows(r.incoming)
      .map((x) => ({
        label: str(x.label),
        items: Array.isArray(x.items) ? x.items.map((i) => str(i)).filter(Boolean).slice(0, MAX_ROWS) : [],
      }))
      .filter((x) => x.label),
    tasksCompleted: Array.isArray(r.tasksCompleted)
      ? r.tasksCompleted.map((i) => str(i)).filter(Boolean).slice(0, MAX_ROWS)
      : [],
    tasksUpcoming: Array.isArray(r.tasksUpcoming)
      ? r.tasksUpcoming.map((i) => str(i)).filter(Boolean).slice(0, MAX_ROWS)
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
