"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FarmTaskType } from "@/types/database";
import { TASK_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/tasks/constants";
import { addDays } from "@/lib/tasks/dates";
import { todayPacific } from "@/lib/utils";
import { TaskPhotoField } from "./TaskPhotoField";
import { AssigneePicker } from "./AssigneePicker";
import type { TaskPerson } from "@/lib/tasks/people";

interface Item {
  id: string;
  name: string;
}

const TASK_TYPES: FarmTaskType[] = [
  "sow",
  "transplant",
  "harvest",
  "terminate",
  "maintenance",
  "inventory",
  "delivery-prep",
  "chef-request",
  "custom",
];

export function NewTaskForm({ items, people }: { items: Item[]; people: TaskPerson[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<FarmTaskType>("custom");
  // Pacific "today" — the UTC date is already tomorrow by late afternoon.
  const today = todayPacific();
  const tomorrow = addDays(today, 1);
  const [dueDate, setDueDate] = useState(today);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3 | 4>(2);
  const [itemId, setItemId] = useState<string>("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title required");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          type,
          due_date: dueDate,
          due_time: dueTime || null,
          priority,
          item_id: itemId || null,
          photo_urls: photoUrls,
          assigned_to: assignedTo || null,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Save failed");
        return;
      }
      // Spanish text for the crew — filled in the background so saving is
      // instant (keepalive lets it finish after we navigate away).
      if (j.task?.id) {
        void fetch(`/api/tasks/${j.task.id}/translate`, { method: "POST", keepalive: true }).catch(() => {});
      }
      router.push("/admin/tasks");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="What needs to be done">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={500}
          autoFocus
          placeholder="e.g. Weed the bed by the greenhouse door"
          className="w-full text-base px-3 py-2.5 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold"
        />
      </Field>

      <TaskPhotoField urls={photoUrls} onChange={setPhotoUrls} onBusyChange={setUploading} />

      <Field label="Details (optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Where, how, how much…"
          className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold resize-none"
        />
      </Field>

      <div>
        <span className="block text-[10px] tracking-[0.18em] uppercase text-pf-gold-700 font-medium mb-1">
          When
        </span>
        <div className="flex gap-2">
          {[
            { label: "Today", value: today },
            { label: "Tomorrow", value: tomorrow },
          ].map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setDueDate(o.value)}
              aria-pressed={dueDate === o.value}
              className={`min-h-[44px] px-4 rounded-md border text-sm font-medium transition-colors ${
                dueDate === o.value
                  ? "bg-farm-green text-white border-farm-green"
                  : "bg-white text-farm-dark border-pf-master-gold/30 hover:bg-farm-cream"
              }`}
            >
              {o.label}
            </button>
          ))}
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            aria-label="Due date"
            className="flex-1 min-w-0 text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold"
          />
        </div>
      </div>

      <AssigneePicker people={people} value={assignedTo} onChange={setAssignedTo} autoHint="Anyone" />

      <p className="text-[11px] text-farm-muted leading-relaxed">
        The farm team sees this on their task list right away. A Spanish
        translation is added automatically.
      </p>

      <details className="rounded-md border border-pf-master-gold/20 bg-white">
        <summary className="px-3 py-3 text-sm text-farm-dark cursor-pointer select-none">
          More options
        </summary>
        <div className="px-3 pb-3 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FarmTaskType)}
            className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold bg-white"
          >
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3 | 4)}
            className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold bg-white"
          >
            {([1, 2, 3, 4] as const).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Due time (optional)">
        <input
          type="time"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold"
        />
      </Field>

      <Field label="Linked item (optional)">
        <select
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold bg-white"
        >
          <option value="">— none —</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </Field>
        </div>
      </details>

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push("/admin/tasks")}
          className="px-3 py-2 min-h-[44px] text-sm rounded-md border border-pf-master-gold/30 text-farm-dark hover:bg-farm-cream"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || uploading}
          className="px-5 py-2 min-h-[44px] text-sm font-medium rounded-md bg-farm-green text-white hover:bg-farm-green/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : uploading ? "Uploading photo…" : "Create task"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.18em] uppercase text-pf-gold-700 font-medium mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
