import { addDaysISO } from "@/lib/utils";

/**
 * A task someone adds for THEMSELVES from the Head Farm Hand page
 * (/farm-tasks "Add a task for myself"). Deliberately tiny: what to do, and
 * today, tomorrow or a day he picks. The person is never read from the request — the route
 * passes the signed-in user, so nobody can add a task to someone else's list.
 *
 * Pure — tested in tests/lib/tasks/own.test.ts.
 */

export const OWN_TASK_MAX_LENGTH = 300;

/** How far ahead a picked day may be. */
export const OWN_TASK_MAX_DAYS_AHEAD = 366;

export type OwnTaskWhen = "today" | "tomorrow" | "date";

/** A real calendar day (YYYY-MM-DD) from today up to a year out, else null. */
export function parseOwnTaskDate(value: unknown, today: string): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  if (value < today || value > addDaysISO(today, OWN_TASK_MAX_DAYS_AHEAD)) return null;
  return value;
}

export type OwnTaskResult =
  | {
      ok: true;
      row: {
        title: string;
        type: "custom";
        source: "manual";
        due_date: string;
        priority: 2;
        assignee_ids: string[];
        assigned_to: string;
      };
    }
  | { ok: false; error: string };

export function buildOwnTask(body: unknown, userId: string, today: string): OwnTaskResult {
  const raw = (body as { title?: unknown } | null)?.title;
  const title = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!title) return { ok: false, error: "Type what you need to do first." };
  if (title.length > OWN_TASK_MAX_LENGTH) return { ok: false, error: "That is too long — make it shorter." };
  const b = body as { when?: unknown; date?: unknown } | null;
  let due_date = b?.when === "tomorrow" ? addDaysISO(today, 1) : today;
  if (b?.when === "date") {
    const picked = parseOwnTaskDate(b.date, today);
    if (!picked) return { ok: false, error: "Pick a day — today or later." };
    due_date = picked;
  }
  return {
    ok: true,
    row: {
      title,
      type: "custom",
      source: "manual",
      due_date,
      priority: 2,
      assignee_ids: [userId],
      assigned_to: userId,
    },
  };
}

/** Is this a hand-added task that belongs to exactly this one person? */
export function isOwnTask(
  task: { source: string; assignee_ids?: string[] | null },
  userId: string,
): boolean {
  const ids = task.assignee_ids ?? [];
  return task.source === "manual" && ids.length === 1 && ids[0] === userId;
}
