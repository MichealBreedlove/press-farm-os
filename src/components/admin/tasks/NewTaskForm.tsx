"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FarmTaskType } from "@/types/database";
import { TASK_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/tasks/constants";
import { todayIso } from "@/lib/tasks/dates";

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

export function NewTaskForm({ items }: { items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<FarmTaskType>("custom");
  const [dueDate, setDueDate] = useState(todayIso());
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
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Save failed");
        return;
      }
      router.push("/admin/tasks");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Title">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={500}
          className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold resize-none"
        />
      </Field>

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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date">
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
            className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold"
          />
        </Field>
        <Field label="Due time (optional)">
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold"
          />
        </Field>
      </div>

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

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push("/admin/tasks")}
          className="px-3 py-2 text-sm rounded-md border border-pf-master-gold/30 text-farm-dark hover:bg-farm-cream"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-4 py-2 text-sm rounded-md bg-farm-green text-white hover:bg-farm-green/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Create task"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-[0.18em] uppercase text-pf-master-gold font-medium mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
