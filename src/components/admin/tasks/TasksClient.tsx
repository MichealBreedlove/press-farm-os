"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, RefreshCw, CheckCircle, Clock3, X, ChevronRight } from "lucide-react";
import type {
  FarmTask,
  FarmTaskSource,
  InboxTaskDraft,
} from "@/types/database";
import {
  TASK_TYPE_LABELS,
  TASK_TYPE_ICONS,
  TASK_SOURCE_LABELS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
} from "@/lib/tasks/constants";
import { TaskDraftCard } from "./TaskDraftCard";

type Tab = "today" | "upcoming" | "drafts" | "done";
type SourceFilter = "all" | FarmTaskSource;

interface Props {
  initialToday: FarmTask[];
  initialUpcoming: FarmTask[];
  initialDone: FarmTask[];
  initialDrafts: InboxTaskDraft[];
  itemNames: Record<string, string>;
  cropNames: Record<string, string>;
}

const TAB_LABELS: Record<Tab, string> = {
  today: "Today",
  upcoming: "Upcoming",
  drafts: "Drafts",
  done: "Done",
};

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "microgreens-auto", label: "Microgreens" },
  { value: "recurring-item", label: "Recurring" },
  { value: "inbox-confirmed", label: "Chef" },
  { value: "manual", label: "Manual" },
];

export function TasksClient({
  initialToday,
  initialUpcoming,
  initialDone,
  initialDrafts,
  itemNames,
  cropNames,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("today");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [pending, startTransition] = useTransition();

  const sourceOf = (t: FarmTask) => t.source;
  const filterBySource = (list: FarmTask[]) =>
    sourceFilter === "all" ? list : list.filter((t) => sourceOf(t) === sourceFilter);

  const today = useMemo(() => filterBySource(initialToday), [initialToday, sourceFilter]);
  const upcoming = useMemo(() => filterBySource(initialUpcoming), [initialUpcoming, sourceFilter]);
  const done = useMemo(() => filterBySource(initialDone), [initialDone, sourceFilter]);

  async function regenerate() {
    startTransition(async () => {
      await fetch("/api/tasks/regenerate", { method: "POST" });
      router.refresh();
    });
  }

  async function completeTask(id: string) {
    startTransition(async () => {
      await fetch(`/api/tasks/${id}/complete`, { method: "POST" });
      router.refresh();
    });
  }

  async function snoozeTask(id: string, days: number) {
    startTransition(async () => {
      await fetch(`/api/tasks/${id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      router.refresh();
    });
  }

  async function cancelTask(id: string) {
    if (!confirm("Cancel this task?")) return;
    startTransition(async () => {
      await fetch(`/api/tasks/${id}/cancel`, { method: "POST" });
      router.refresh();
    });
  }

  const draftsLowConfidence = initialDrafts.filter((d) => d.confidence === "low");
  const draftsOther = initialDrafts.filter((d) => d.confidence !== "low");

  return (
    <div className="max-w-3xl mx-auto px-4 pb-8">
      {/* Action row */}
      <div className="flex items-center justify-between gap-3 mt-4 mb-3">
        <Link
          href="/admin/tasks/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-farm-green text-white text-sm font-medium hover:bg-farm-green/90"
        >
          <Plus className="w-4 h-4" /> New task
        </Link>
        <button
          onClick={regenerate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-pf-master-gold/30 text-farm-dark text-sm hover:bg-farm-cream disabled:opacity-50"
          aria-label="Regenerate auto tasks"
        >
          <RefreshCw className={`w-4 h-4 ${pending ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>

      {/* Tab strip */}
      <div className="flex items-center gap-1 border-b border-pf-master-gold/20 mb-3 overflow-x-auto">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
          const count =
            t === "today"
              ? today.length
              : t === "upcoming"
                ? upcoming.length
                : t === "drafts"
                  ? initialDrafts.length
                  : done.length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-3 py-2 text-sm whitespace-nowrap ${
                tab === t
                  ? "text-farm-dark font-medium border-b-2 border-pf-master-gold -mb-px"
                  : "text-farm-muted hover:text-farm-dark"
              }`}
            >
              {TAB_LABELS[t]}
              {count > 0 && (
                <span className="ml-1.5 text-[10px] tabular-nums text-farm-muted">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Source filter chips — hidden on drafts tab */}
      {tab !== "drafts" && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {SOURCE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSourceFilter(f.value)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                sourceFilter === f.value
                  ? "bg-farm-dark text-white border-farm-dark"
                  : "bg-white text-farm-muted border-pf-master-gold/20 hover:border-pf-master-gold/40"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {tab === "today" && (
        <TaskList
          tasks={today}
          itemNames={itemNames}
          cropNames={cropNames}
          onComplete={completeTask}
          onSnooze={snoozeTask}
          onCancel={cancelTask}
          emptyMessage="Nothing due today. Nice."
        />
      )}
      {tab === "upcoming" && (
        <GroupedByDate
          tasks={upcoming}
          itemNames={itemNames}
          cropNames={cropNames}
          onComplete={completeTask}
          onSnooze={snoozeTask}
          onCancel={cancelTask}
        />
      )}
      {tab === "drafts" && (
        <DraftList
          lowConfidence={draftsLowConfidence}
          rest={draftsOther}
        />
      )}
      {tab === "done" && (
        <TaskList
          tasks={done}
          itemNames={itemNames}
          cropNames={cropNames}
          onComplete={completeTask}
          onSnooze={snoozeTask}
          onCancel={cancelTask}
          variant="done"
          emptyMessage="No completed tasks in the last 30 days."
        />
      )}
    </div>
  );
}

interface ListProps {
  tasks: FarmTask[];
  itemNames: Record<string, string>;
  cropNames: Record<string, string>;
  onComplete: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
  onCancel: (id: string) => void;
  variant?: "open" | "done";
  emptyMessage?: string;
}

function TaskList({
  tasks,
  itemNames,
  cropNames,
  onComplete,
  onSnooze,
  onCancel,
  variant = "open",
  emptyMessage,
}: ListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-farm-muted text-sm">
        {emptyMessage ?? "No tasks."}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {tasks.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          itemNames={itemNames}
          cropNames={cropNames}
          onComplete={onComplete}
          onSnooze={onSnooze}
          onCancel={onCancel}
          variant={variant}
        />
      ))}
    </ul>
  );
}

function GroupedByDate({
  tasks,
  itemNames,
  cropNames,
  onComplete,
  onSnooze,
  onCancel,
}: ListProps) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-farm-muted text-sm">
        Nothing scheduled in the next 30 days.
      </div>
    );
  }
  const grouped = new Map<string, FarmTask[]>();
  for (const t of tasks) {
    const arr = grouped.get(t.due_date) ?? [];
    arr.push(t);
    grouped.set(t.due_date, arr);
  }
  const dates = Array.from(grouped.keys()).sort();
  return (
    <div className="space-y-5">
      {dates.map((d) => (
        <div key={d}>
          <h3 className="text-[10px] tracking-[0.18em] uppercase text-pf-master-gold font-medium mb-2">
            {formatDateHeading(d)}
          </h3>
          <ul className="space-y-2">
            {grouped.get(d)!.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                itemNames={itemNames}
                cropNames={cropNames}
                onComplete={onComplete}
                onSnooze={onSnooze}
                onCancel={onCancel}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface RowProps {
  task: FarmTask;
  itemNames: Record<string, string>;
  cropNames: Record<string, string>;
  onComplete: (id: string) => void;
  onSnooze: (id: string, days: number) => void;
  onCancel: (id: string) => void;
  variant?: "open" | "done";
}

function TaskRow({
  task,
  itemNames,
  cropNames,
  onComplete,
  onSnooze,
  onCancel,
  variant = "open",
}: RowProps) {
  const [expanded, setExpanded] = useState(false);
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (task.microgreen_crop_id && cropNames[task.microgreen_crop_id]) {
      parts.push(cropNames[task.microgreen_crop_id]);
    } else if (task.item_id && itemNames[task.item_id]) {
      parts.push(itemNames[task.item_id]);
    }
    if (task.due_time) parts.push(task.due_time.slice(0, 5));
    return parts.join(" · ");
  }, [task, itemNames, cropNames]);

  const isOverdue = variant === "open" && task.due_date < new Date().toISOString().slice(0, 10);

  return (
    <li className="bg-white border border-pf-master-gold/15 rounded-lg shadow-sm">
      <div className="flex items-start gap-3 p-3">
        {variant === "open" ? (
          <button
            onClick={() => onComplete(task.id)}
            className="mt-0.5 min-w-[28px] min-h-[28px] rounded-full border-2 border-pf-master-gold/40 hover:border-farm-green hover:bg-farm-green/10 flex items-center justify-center transition-colors"
            aria-label="Complete task"
          >
            <span className="w-4 h-4" />
          </button>
        ) : (
          <CheckCircle className="w-7 h-7 text-farm-green flex-shrink-0 mt-0.5" />
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left min-w-0"
        >
          <div className="flex items-start gap-2">
            <span className="text-base flex-shrink-0" aria-hidden>
              {TASK_TYPE_ICONS[task.type]}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-farm-dark leading-snug">{task.title}</p>
              {subtitle && (
                <p className="text-[11px] text-farm-muted mt-0.5">{subtitle}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-farm-cream text-farm-muted">
                  {TASK_SOURCE_LABELS[task.source]}
                </span>
                {variant === "open" && task.priority !== 2 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}
                  >
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                )}
                {isOverdue && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded badge-red">
                    Overdue
                  </span>
                )}
                {variant === "done" && task.completed_at && (
                  <span className="text-[10px] text-farm-muted">
                    {formatRelative(task.completed_at)}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight
              className={`w-4 h-4 text-farm-muted flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
            />
          </div>
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-pf-master-gold/10 pt-3 space-y-3">
          {task.description && (
            <p className="text-xs text-farm-muted whitespace-pre-wrap">
              {task.description}
            </p>
          )}
          <div className="text-[10px] text-farm-muted">
            Due {task.due_date} · {TASK_TYPE_LABELS[task.type]}
          </div>
          {variant === "open" && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onSnooze(task.id, 1)}
                className="text-xs px-2 py-1 rounded border border-pf-master-gold/30 text-farm-dark hover:bg-farm-cream inline-flex items-center gap-1"
              >
                <Clock3 className="w-3 h-3" /> +1d
              </button>
              <button
                onClick={() => onSnooze(task.id, 3)}
                className="text-xs px-2 py-1 rounded border border-pf-master-gold/30 text-farm-dark hover:bg-farm-cream inline-flex items-center gap-1"
              >
                <Clock3 className="w-3 h-3" /> +3d
              </button>
              <button
                onClick={() => onSnooze(task.id, 7)}
                className="text-xs px-2 py-1 rounded border border-pf-master-gold/30 text-farm-dark hover:bg-farm-cream inline-flex items-center gap-1"
              >
                <Clock3 className="w-3 h-3" /> +1w
              </button>
              <button
                onClick={() => onCancel(task.id)}
                className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
          )}
          {task.completion_notes && (
            <p className="text-xs italic text-farm-muted">
              Notes: {task.completion_notes}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function DraftList({
  lowConfidence,
  rest,
}: {
  lowConfidence: InboxTaskDraft[];
  rest: InboxTaskDraft[];
}) {
  if (lowConfidence.length === 0 && rest.length === 0) {
    return (
      <div className="text-center py-12 text-farm-muted text-sm">
        No proposed drafts pending. Chef requests will appear here after they email.
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {lowConfidence.length > 0 && (
        <div>
          <h3 className="text-[10px] tracking-[0.18em] uppercase text-amber-700 font-medium mb-2">
            Needs review
          </h3>
          <div className="space-y-3">
            {lowConfidence.map((d) => (
              <TaskDraftCard key={d.id} draft={d} />
            ))}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          <h3 className="text-[10px] tracking-[0.18em] uppercase text-pf-master-gold font-medium mb-2">
            Suggested
          </h3>
          <div className="space-y-3">
            {rest.map((d) => (
              <TaskDraftCard key={d.id} draft={d} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateHeading(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
