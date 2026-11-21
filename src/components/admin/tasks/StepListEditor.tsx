"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { AssigneePicker } from "./AssigneePicker";
import type { TaskPerson } from "@/lib/tasks/people";

export interface ChainStep {
  id: string;
  title: string;
  description: string | null;
  stage_index: number | null;
  status: string;
  due_date: string;
  stage_offset_days: number | null;
  assignee_ids: string[];
  assigned_to: string | null;
}

/**
 * Every step of a multi-step task, editable in place — at any time, done or
 * not: what, details, when (days after the previous step or a date), who,
 * done / undo, move up / down, remove. The step being edited in the main
 * form above is marked and not repeated here.
 */
export function StepListEditor({
  chain,
  currentId,
  people,
}: {
  chain: ChainStep[];
  currentId: string;
  people: TaskPerson[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const nameOf = new Map(people.map((p) => [p.id, p.name.split(/\s+/)[0]]));
  const who = (s: ChainStep) => {
    const ids = s.assignee_ids?.length ? s.assignee_ids : s.assigned_to ? [s.assigned_to] : [];
    return ids.length ? ids.map((id) => nameOf.get(id) ?? "?").join(", ") : "Anyone";
  };

  return (
    <ol className="mb-3 rounded-lg border border-pf-master-gold/20 bg-white divide-y divide-pf-master-gold/10">
      {chain.map((s, i) => {
        const isCurrent = s.id === currentId;
        const open = openId === s.id;
        const done = s.status === "completed";
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : s.id)}
              aria-expanded={open}
              className="w-full min-h-[52px] px-3 py-2 flex items-center gap-3 text-left"
            >
              <span
                className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-semibold ${
                  done ? "bg-farm-green text-white" : "bg-farm-cream text-farm-dark"
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : s.stage_index ?? i + 1}
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-sm leading-snug ${isCurrent ? "font-semibold" : ""} text-farm-dark`}>
                  {s.title}
                  {isCurrent && <span className="font-normal text-farm-muted"> · this step</span>}
                </span>
                <span className="block text-[11px] text-farm-muted mt-0.5">
                  {done ? "Done" : s.due_date}
                  {s.stage_offset_days != null && !done ? ` · ${s.stage_offset_days} days after step ${(s.stage_index ?? 2) - 1}` : ""}
                  {" · "}
                  {who(s)}
                </span>
              </span>
              <ChevronRight
                className={`w-4 h-4 text-farm-muted flex-shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
              />
            </button>
            {open && (
              <StepEditor
                step={s}
                isCurrent={isCurrent}
                isFirst={i === 0}
                isLast={i === chain.length - 1}
                people={people}
                onClose={() => setOpenId(null)}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepEditor({
  step,
  isCurrent,
  isFirst,
  isLast,
  people,
  onClose,
}: {
  step: ChainStep;
  isCurrent: boolean;
  isFirst: boolean;
  isLast: boolean;
  people: TaskPerson[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description ?? "");
  const [when, setWhen] = useState<"after" | "date">(step.stage_offset_days != null && !isFirst ? "after" : "date");
  const [offsetDays, setOffsetDays] = useState(String(step.stage_offset_days ?? 7));
  const [dueDate, setDueDate] = useState(step.due_date);
  const [assignees, setAssignees] = useState<string[]>(
    step.assignee_ids?.length ? step.assignee_ids : step.assigned_to ? [step.assigned_to] : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, init: RequestInit, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, init);
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "Couldn't save");
        return false;
      }
      after?.();
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      setError("A step needs a title");
      return;
    }
    const englishChanged = title.trim() !== step.title || (description.trim() || null) !== (step.description ?? null);
    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      assignee_ids: assignees,
    };
    if (when === "after") body.stage_offset_days = Number(offsetDays);
    else body.due_date = dueDate;
    const ok = await call(
      `/api/tasks/${step.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      onClose,
    );
    if (ok && englishChanged) {
      void fetch(`/api/tasks/${step.id}/translate`, { method: "POST", keepalive: true }).catch(() => {});
    }
  }

  const done = step.status === "completed";
  const field =
    "w-full text-sm px-3 py-2 border border-pf-master-gold/30 rounded-md focus:outline-none focus:ring-1 focus:ring-pf-master-gold bg-white";
  const small =
    "min-h-[44px] px-3 rounded-md border border-pf-master-gold/30 text-sm text-farm-dark bg-white hover:bg-farm-cream disabled:opacity-40 inline-flex items-center gap-1.5";

  return (
    <div className="px-3 pb-4 pt-1 space-y-3 bg-farm-cream/40">
      {isCurrent ? (
        <p className="text-xs text-farm-muted">This is the step open in the form above — edit it there.</p>
      ) : (
        <>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="What needs to be done"
            maxLength={500}
            className={`${field} text-base`}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Details (optional)"
            aria-label="Details"
            rows={2}
            className={`${field} resize-none`}
          />
          <div className="flex flex-wrap gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setWhen("after")}
                aria-pressed={when === "after"}
                className={`min-h-[44px] px-3 rounded-md border text-sm ${
                  when === "after" ? "bg-farm-green text-white border-farm-green" : "bg-white border-pf-master-gold/30"
                }`}
              >
                Days after previous step
              </button>
            )}
            <button
              type="button"
              onClick={() => setWhen("date")}
              aria-pressed={when === "date"}
              className={`min-h-[44px] px-3 rounded-md border text-sm ${
                when === "date" ? "bg-farm-green text-white border-farm-green" : "bg-white border-pf-master-gold/30"
              }`}
            >
              On a date
            </button>
          </div>
          {when === "after" ? (
            <label className="flex items-center gap-2 text-sm text-farm-dark">
              <input
                type="number"
                min={0}
                max={365}
                inputMode="numeric"
                value={offsetDays}
                onChange={(e) => setOffsetDays(e.target.value)}
                className="w-20 flex-shrink-0 text-base px-3 py-2 border border-pf-master-gold/30 rounded-md bg-white"
              />
              days after the previous step is finished
            </label>
          ) : (
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Date" className={field} />
          )}
          <AssigneePicker
            people={people}
            value={assignees}
            onChange={(ids) => setAssignees(ids ?? [])}
            autoHint="Anyone"
            label="Who"
          />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="w-full min-h-[44px] rounded-md bg-farm-green text-white text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save this step"}
          </button>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {!isCurrent &&
          (done ? (
            <button type="button" disabled={busy} className={small} onClick={() => call(`/api/tasks/${step.id}/reopen`, { method: "POST" })}>
              <RotateCcw className="w-4 h-4" /> Mark not done
            </button>
          ) : (
            <button type="button" disabled={busy} className={small} onClick={() => call(`/api/tasks/${step.id}/complete`, { method: "POST" })}>
              <Check className="w-4 h-4" /> Mark done
            </button>
          ))}
        <button
          type="button"
          disabled={busy || isFirst}
          className={small}
          aria-label="Move step up"
          onClick={() =>
            call(`/api/tasks/${step.id}/move`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ direction: "up" }),
            })
          }
        >
          <ArrowUp className="w-4 h-4" /> Up
        </button>
        <button
          type="button"
          disabled={busy || isLast}
          className={small}
          aria-label="Move step down"
          onClick={() =>
            call(`/api/tasks/${step.id}/move`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ direction: "down" }),
            })
          }
        >
          <ArrowDown className="w-4 h-4" /> Down
        </button>
        {!isCurrent && (
          <button
            type="button"
            disabled={busy}
            className={`${small} border-red-200 text-red-700 hover:bg-red-50`}
            onClick={() => {
              if (window.confirm(`Remove step "${step.title}"?`)) {
                void call(`/api/tasks/${step.id}`, { method: "DELETE" }, onClose);
              }
            }}
          >
            <Trash2 className="w-4 h-4" /> Remove step
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
