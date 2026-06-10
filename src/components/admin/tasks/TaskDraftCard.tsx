"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Pencil, X, Mail } from "lucide-react";
import type { InboxTaskDraft, InboxTaskDraftScheduleItem } from "@/types/database";

interface Props {
  draft: InboxTaskDraft;
}

const TASK_TYPE_LABEL: Record<string, string> = {
  sow: "Sow",
  transplant: "Transplant",
  harvest: "Harvest",
  maintenance: "Maintenance",
};

function offsetLabel(days: number): string {
  if (days === 0) return "today";
  if (days < 0) return `${-days}d ago`;
  if (days < 7) return `+${days}d`;
  if (days < 30) return `+${Math.round(days / 7)}w`;
  return `+${Math.round(days / 30)}mo`;
}

export function TaskDraftCard({ draft }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [schedule, setSchedule] = useState<InboxTaskDraftScheduleItem[]>(
    draft.proposed_schedule,
  );
  const [pending, startTransition] = useTransition();

  async function confirm() {
    startTransition(async () => {
      await fetch(`/api/tasks/drafts/${draft.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: editing ? JSON.stringify({ schedule_override: schedule }) : "{}",
      });
      router.refresh();
    });
  }

  async function dismiss() {
    if (!window.confirm("Dismiss this draft?")) return;
    startTransition(async () => {
      await fetch(`/api/tasks/drafts/${draft.id}/dismiss`, { method: "POST" });
      router.refresh();
    });
  }

  function updateItem(idx: number, patch: Partial<InboxTaskDraftScheduleItem>) {
    setSchedule((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  const confidenceColor =
    draft.confidence === "high"
      ? "badge-green"
      : draft.confidence === "medium"
        ? "badge-gold"
        : "bg-amber-100 text-amber-800";

  return (
    <article className="bg-white border border-pf-master-gold/15 rounded-lg shadow-sm p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h4 className="text-base font-display text-farm-dark">
            {draft.proposed_item_name}
          </h4>
          {draft.matched_item_id ? (
            <p className="text-[11px] text-farm-muted mt-0.5">
              Matched to catalog item
            </p>
          ) : (
            <p className="text-[11px] text-amber-700 mt-0.5">
              Not in catalog yet
            </p>
          )}
        </div>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${confidenceColor} whitespace-nowrap`}
        >
          {draft.confidence} confidence
        </span>
      </div>

      <ul className="space-y-1.5 mb-3">
        {schedule.map((item, idx) =>
          editing ? (
            <li key={idx} className="flex items-center gap-2">
              <select
                value={item.task_type}
                aria-label="Task type"
                onChange={(e) =>
                  updateItem(idx, { task_type: e.target.value as InboxTaskDraftScheduleItem["task_type"] })
                }
                className="text-xs px-2 py-1 border border-pf-master-gold/30 rounded bg-white"
              >
                {Object.entries(TASK_TYPE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={item.title}
                aria-label="Task title"
                onChange={(e) => updateItem(idx, { title: e.target.value })}
                className="flex-1 text-xs px-2 py-1 border border-pf-master-gold/30 rounded"
              />
              <input
                type="number"
                value={item.offset_days_from_today}
                aria-label="Days from today"
                onChange={(e) =>
                  updateItem(idx, { offset_days_from_today: Number(e.target.value) || 0 })
                }
                className="w-16 text-xs px-2 py-1 border border-pf-master-gold/30 rounded text-right"
                step={1}
              />
              <span className="text-[10px] text-farm-muted w-8">days</span>
            </li>
          ) : (
            <li key={idx} className="flex items-start gap-2 text-sm">
              <span className="text-[10px] font-medium uppercase tracking-wider text-pf-master-gold w-20 flex-shrink-0 mt-0.5">
                {TASK_TYPE_LABEL[item.task_type] ?? item.task_type}
              </span>
              <span className="flex-1 text-farm-dark">{item.title}</span>
              <span className="text-[11px] text-farm-muted whitespace-nowrap">
                {offsetLabel(item.offset_days_from_today)}
              </span>
            </li>
          ),
        )}
      </ul>

      {draft.reasoning && !editing && (
        <p className="text-[11px] italic text-farm-muted mb-3 border-l-2 border-pf-master-gold/20 pl-2">
          {draft.reasoning}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-pf-master-gold/10">
        <Link
          href={`/admin/inbox/${draft.inbound_message_id}`}
          className="inline-flex items-center gap-1 text-[11px] text-farm-muted hover:text-farm-dark"
        >
          <Mail className="w-3 h-3" /> View email
        </Link>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs px-2 py-1 rounded border border-pf-master-gold/30 text-farm-dark hover:bg-farm-cream inline-flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" /> {editing ? "Done editing" : "Edit"}
          </button>
          <button
            onClick={dismiss}
            disabled={pending}
            className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center gap-1 disabled:opacity-50"
          >
            <X className="w-3 h-3" /> Dismiss
          </button>
          <button
            onClick={confirm}
            disabled={pending}
            className="text-xs px-3 py-1 rounded bg-farm-green text-white hover:bg-farm-green/90 inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Check className="w-3 h-3" /> Confirm {schedule.length} task{schedule.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </article>
  );
}
