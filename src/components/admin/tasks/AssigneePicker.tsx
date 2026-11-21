"use client";

import type { TaskPerson } from "@/lib/tasks/people";

/** "Assign to" chips on the task forms — one tap per person. */
export function AssigneePicker({
  people,
  value,
  onChange,
  autoHint,
}: {
  people: TaskPerson[];
  value: string;
  onChange: (id: string) => void;
  /** Label for the "nobody picked" choice — differs for automated tasks. */
  autoHint: string;
}) {
  const options = [{ id: "", name: autoHint }, ...people.map((p) => ({ id: p.id, name: p.name }))];
  return (
    <div>
      <span className="block text-[10px] tracking-[0.18em] uppercase text-pf-gold-700 font-medium mb-1">
        Assign to
      </span>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Assign to">
        {options.map((o) => (
          <button
            key={o.id || "anyone"}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={value === o.id}
            className={`min-h-[44px] px-4 rounded-md border text-sm font-medium transition-colors ${
              value === o.id
                ? "bg-farm-green text-white border-farm-green"
                : "bg-white text-farm-dark border-pf-master-gold/30 hover:bg-farm-cream"
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}
