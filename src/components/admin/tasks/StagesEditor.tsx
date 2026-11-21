"use client";

import { Plus, X } from "lucide-react";
import { AssigneePicker } from "./AssigneePicker";
import type { TaskPerson } from "@/lib/tasks/people";

export interface StageDraft {
  key: string;
  title: string;
  description: string;
  when: "after" | "date";
  offsetDays: string;
  dueDate: string;
  /** null = same people as step 1. */
  assigneeIds: string[] | null;
}

export function newStageDraft(): StageDraft {
  return {
    key: Math.random().toString(36).slice(2),
    title: "",
    description: "",
    when: "after",
    offsetDays: "21",
    dueDate: "",
    assigneeIds: null,
  };
}

/** Form drafts → the API's `stages` body (blank titles dropped). */
export function stageDraftsToPayload(drafts: StageDraft[]) {
  return drafts
    .filter((d) => d.title.trim())
    .map((d) => ({
      title: d.title.trim(),
      description: d.description.trim() || null,
      offset_days: d.when === "after" ? Number(d.offsetDays) : null,
      due_date: d.when === "date" ? d.dueDate || null : null,
      assignee_ids: d.assigneeIds,
    }));
}

/**
 * "Next steps" on the task forms: step 2, 3 … of a multi-step task (e.g.
 * sow in a 50-cell tray, then 21 days later transplant to the field). Each
 * step is due N days after the previous one is FINISHED, or on a fixed
 * date. Farm hands only ever see the step they're on.
 */
export function StagesEditor({
  drafts,
  onChange,
  firstStepNumber = 2,
  people,
}: {
  drafts: StageDraft[];
  onChange: (next: StageDraft[]) => void;
  /** Who a step can be given to. */
  people: TaskPerson[];
  /** Number shown on the first draft (2 on a new task; after the chain on edit). */
  firstStepNumber?: number;
}) {
  const update = (key: string, patch: Partial<StageDraft>) =>
    onChange(drafts.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const field =
    "w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold bg-white";

  return (
    <div className="space-y-3">
      {drafts.map((d, i) => (
        <div key={d.key} className="rounded-lg border border-pf-master-gold/25 bg-white p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] tracking-[0.18em] uppercase text-pf-gold-700 font-medium">
              Step {firstStepNumber + i}
            </span>
            <button
              type="button"
              onClick={() => onChange(drafts.filter((x) => x.key !== d.key))}
              aria-label={`Remove step ${firstStepNumber + i}`}
              className="min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center text-farm-muted hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            value={d.title}
            onChange={(e) => update(d.key, { title: e.target.value })}
            placeholder="e.g. Transplant the seedlings to the field"
            aria-label={`Step ${firstStepNumber + i} — what needs to be done`}
            maxLength={500}
            className={`${field} text-base`}
          />
          <textarea
            value={d.description}
            onChange={(e) => update(d.key, { description: e.target.value })}
            placeholder="Details (optional) — where, how, how much"
            aria-label={`Step ${firstStepNumber + i} — details`}
            rows={2}
            className={`${field} resize-none`}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-farm-dark">
            <button
              type="button"
              onClick={() => update(d.key, { when: "after" })}
              aria-pressed={d.when === "after"}
              className={`min-h-[44px] px-3 rounded-md border ${
                d.when === "after" ? "bg-farm-green text-white border-farm-green" : "bg-white border-pf-master-gold/30"
              }`}
            >
              Days after previous step
            </button>
            <button
              type="button"
              onClick={() => update(d.key, { when: "date" })}
              aria-pressed={d.when === "date"}
              className={`min-h-[44px] px-3 rounded-md border ${
                d.when === "date" ? "bg-farm-green text-white border-farm-green" : "bg-white border-pf-master-gold/30"
              }`}
            >
              On a date
            </button>
          </div>
          {d.when === "after" ? (
            <label className="flex items-center gap-2 text-sm text-farm-dark">
              <input
                type="number"
                min={0}
                max={365}
                inputMode="numeric"
                value={d.offsetDays}
                onChange={(e) => update(d.key, { offsetDays: e.target.value })}
                className="w-20 flex-shrink-0 text-base px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold bg-white"
              />
              days after step {firstStepNumber + i - 1} is finished
            </label>
          ) : (
            <input
              type="date"
              value={d.dueDate}
              onChange={(e) => update(d.key, { dueDate: e.target.value })}
              aria-label={`Step ${firstStepNumber + i} date`}
              className={field}
            />
          )}
          <AssigneePicker
            people={people}
            value={d.assigneeIds}
            onChange={(ids) => update(d.key, { assigneeIds: ids })}
            autoHint="Anyone"
            inheritLabel="Same as step 1"
            label={`Step ${firstStepNumber + i} — who`}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...drafts, newStageDraft()])}
        className="w-full min-h-[48px] rounded-lg border border-dashed border-farm-green/50 text-sm font-medium text-farm-green bg-white hover:bg-farm-green/[0.04] inline-flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" /> Add a next step
      </button>
    </div>
  );
}
