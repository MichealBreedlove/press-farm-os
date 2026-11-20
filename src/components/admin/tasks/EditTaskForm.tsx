"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FarmTask, FarmTaskType } from "@/types/database";
import { TASK_TYPE_LABELS, PRIORITY_LABELS } from "@/lib/tasks/constants";
import { TaskPhotoField } from "./TaskPhotoField";

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

export function EditTaskForm({ task, items }: { task: FarmTask; items: Item[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [type, setType] = useState<FarmTaskType>(task.type);
  const [dueDate, setDueDate] = useState(task.due_date);
  const [dueTime, setDueTime] = useState(task.due_time ?? "");
  const [priority, setPriority] = useState<1 | 2 | 3 | 4>(task.priority);
  const [itemId, setItemId] = useState<string>(task.item_id ?? "");
  const [completionNotes, setCompletionNotes] = useState(task.completion_notes ?? "");
  const [photoUrls, setPhotoUrls] = useState<string[]>(task.photo_urls ?? []);
  const [uploading, setUploading] = useState(false);
  const [titleEs, setTitleEs] = useState(task.title_es ?? "");
  const [descriptionEs, setDescriptionEs] = useState(task.description_es ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title required");
      return;
    }
    // Spanish: if Micheal edited it by hand, save his text. If only the
    // English changed, re-translate in the background instead.
    const englishChanged =
      title.trim() !== task.title || (description.trim() || null) !== (task.description ?? null);
    const spanishEdited =
      titleEs.trim() !== (task.title_es ?? "") || descriptionEs.trim() !== (task.description_es ?? "");
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          type,
          due_date: dueDate,
          due_time: dueTime || null,
          priority,
          item_id: itemId || null,
          completion_notes: completionNotes.trim() || null,
          photo_urls: photoUrls,
          ...(spanishEdited
            ? { title_es: titleEs.trim() || null, description_es: descriptionEs.trim() || null }
            : {}),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Save failed");
        return;
      }
      if (!spanishEdited && (englishChanged || !task.title_es)) {
        void fetch(`/api/tasks/${task.id}/translate`, { method: "POST", keepalive: true }).catch(() => {});
      }
      router.push("/admin/tasks");
      router.refresh();
    });
  }

  async function reopen() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/tasks/${task.id}/reopen`, { method: "POST" });
      if (!res.ok) {
        setError("Reopen failed");
        return;
      }
      router.push("/admin/tasks");
      router.refresh();
    });
  }

  async function deleteTask() {
    if (!window.confirm("Permanently cancel this task? It will move to history.")) return;
    setError(null);
    startTransition(async () => {
      await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      router.push("/admin/tasks");
      router.refresh();
    });
  }

  const isClosed =
    task.status === "completed" ||
    task.status === "superseded" ||
    task.status === "cancelled";

  return (
    <form onSubmit={submit} className="space-y-4">
      {isClosed && (
        <div className="rounded-md border border-pf-master-gold/30 bg-farm-cream/50 px-3 py-2 text-xs text-farm-dark">
          Status: <strong>{task.status}</strong>. Use{" "}
          <button
            type="button"
            onClick={reopen}
            disabled={pending}
            className="underline text-farm-green hover:text-farm-green/80 disabled:opacity-50"
          >
            Reopen
          </button>{" "}
          to move back to Open.
        </div>
      )}

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

      <TaskPhotoField urls={photoUrls} onChange={setPhotoUrls} onBusyChange={setUploading} />

      <details className="rounded-md border border-pf-master-gold/20 bg-white">
        <summary className="px-3 py-3 text-sm text-farm-dark cursor-pointer select-none">
          Spanish (what the farm team reads)
        </summary>
        <div className="px-3 pb-3 space-y-3">
          <p className="text-[11px] text-farm-muted leading-relaxed">
            Translated automatically when you save. Edit here to correct it;
            leave it alone and it follows the English.
          </p>
          <Field label="Título">
            <input
              type="text"
              lang="es"
              value={titleEs}
              onChange={(e) => setTitleEs(e.target.value)}
              maxLength={500}
              className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold"
            />
          </Field>
          <Field label="Descripción">
            <textarea
              lang="es"
              value={descriptionEs}
              onChange={(e) => setDescriptionEs(e.target.value)}
              rows={3}
              className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold resize-none"
            />
          </Field>
        </div>
      </details>

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

      {task.status === "completed" && (
        <Field label="Completion notes">
          <textarea
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            rows={2}
            className="w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold resize-none"
          />
        </Field>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <button
          type="button"
          onClick={deleteTask}
          disabled={pending}
          className="px-3 py-2 text-sm rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Cancel task
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/admin/tasks")}
            className="px-3 py-2 text-sm rounded-md border border-pf-master-gold/30 text-farm-dark hover:bg-farm-cream"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={pending || uploading}
            className="px-4 py-2 text-sm rounded-md bg-farm-green text-white hover:bg-farm-green/90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
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
