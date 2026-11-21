/**
 * Multi-step farm tasks ("stages") — pure helpers, tested in
 * tests/lib/tasks/stages.test.ts. Each step is its own farm_tasks row; steps
 * share a stage_group_id and are numbered by stage_index from 1.
 */

export interface StageInput {
  title: string;
  description: string | null;
  /** Days after the previous step is finished. */
  offset_days: number | null;
  /** A fixed date instead of an offset. */
  due_date: string | null;
}

export interface StagedRow {
  stage_group_id: string | null;
  stage_index: number | null;
  status: string;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Validates the follow-on steps a form sends. Bad rows are dropped. */
export function sanitizeStages(input: unknown, max = 9): StageInput[] {
  if (!Array.isArray(input)) return [];
  const out: StageInput[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim().slice(0, 500) : "";
    if (!title) continue;
    const description =
      typeof r.description === "string" && r.description.trim() ? r.description.trim().slice(0, 4000) : null;
    const due = typeof r.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.due_date) ? r.due_date : null;
    const off = Number(r.offset_days);
    const offset = !due && Number.isFinite(off) && off >= 0 && off <= 365 ? Math.round(off) : null;
    if (!due && offset === null) continue; // a step needs a "when"
    out.push({ title, description, offset_days: offset, due_date: due });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Provisional due dates for a chain: a fixed date is kept; an offset step is
 * due `offset` days after the previous step's date. Offsets are recomputed
 * from the real finish date when the previous step is completed.
 */
export function planStageDates(firstDue: string, stages: StageInput[]): string[] {
  const dates: string[] = [];
  let prev = firstDue;
  for (const s of stages) {
    const d = s.due_date ?? addDays(prev, s.offset_days ?? 0);
    dates.push(d);
    prev = d;
  }
  return dates;
}

/** Due date of the next step once the previous one is finished on `finishedOn`. */
export function nextStageDueDate(finishedOn: string, offsetDays: number): string {
  return addDays(finishedOn, offsetDays);
}

/**
 * Of a list of OPEN tasks, keep only the current step of each chain (the
 * lowest stage_index still open in its group). `openStagesByGroup` gives,
 * per group, the lowest open stage_index across the WHOLE table — so a later
 * step is hidden even when the earlier one falls outside the list's window.
 */
export function currentStagesOnly<T extends StagedRow>(
  tasks: T[],
  lowestOpenByGroup: Map<string, number>,
): T[] {
  return tasks.filter((t) => {
    if (!t.stage_group_id || t.stage_index == null) return true;
    const lowest = lowestOpenByGroup.get(t.stage_group_id);
    return lowest === undefined || t.stage_index <= lowest;
  });
}
