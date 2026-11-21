"use client";

import type { TaskPerson } from "@/lib/tasks/people";

/**
 * "Assign to" chips on the task forms. Tap people to add or remove them — a
 * task can belong to several people. "Anyone" (or the automatic owner, for
 * cron tasks) clears the list. With `inheritLabel`, a later step of a
 * multi-step task can also stay on "Same as step 1" (value null).
 */
export function AssigneePicker({
  people,
  value,
  onChange,
  autoHint,
  inheritLabel,
  label = "Assign to",
}: {
  people: TaskPerson[];
  /** Picked people; [] = anyone / automatic; null = same as step 1. */
  value: string[] | null;
  onChange: (ids: string[] | null) => void;
  /** Label for the "nobody picked" choice — differs for automated tasks. */
  autoHint: string;
  inheritLabel?: string;
  label?: string;
}) {
  const picked = value ?? [];
  const toggle = (id: string) =>
    onChange(picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id]);

  const chip = (active: boolean) =>
    `min-h-[44px] px-4 rounded-md border text-sm font-medium transition-colors ${
      active
        ? "bg-farm-green text-white border-farm-green"
        : "bg-white text-farm-dark border-pf-master-gold/30 hover:bg-farm-cream"
    }`;

  return (
    <div>
      <span className="block text-[10px] tracking-[0.18em] uppercase text-pf-gold-700 font-medium mb-1">
        {label} <span className="normal-case tracking-normal text-farm-muted">· tap one or more</span>
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {inheritLabel && (
          <button type="button" onClick={() => onChange(null)} aria-pressed={value === null} className={chip(value === null)}>
            {inheritLabel}
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange([])}
          aria-pressed={value !== null && picked.length === 0}
          className={chip(value !== null && picked.length === 0)}
        >
          {autoHint}
        </button>
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            aria-pressed={picked.includes(p.id)}
            className={chip(picked.includes(p.id))}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
