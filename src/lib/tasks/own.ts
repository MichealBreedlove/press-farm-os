import { addDaysISO } from "@/lib/utils";

/**
 * A task someone adds for THEMSELVES from the Head Farm Hand page
 * (/farm-tasks "Add a task for myself"). Deliberately tiny: what to do, and
 * today or tomorrow. The person is never read from the request — the route
 * passes the signed-in user, so nobody can add a task to someone else's list.
 *
 * Pure — tested in tests/lib/tasks/own.test.ts.
 */

export const OWN_TASK_MAX_LENGTH = 300;

export type OwnTaskWhen = "today" | "tomorrow";

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
  const when = (body as { when?: unknown } | null)?.when === "tomorrow" ? "tomorrow" : "today";
  return {
    ok: true,
    row: {
      title,
      type: "custom",
      source: "manual",
      due_date: when === "tomorrow" ? addDaysISO(today, 1) : today,
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
