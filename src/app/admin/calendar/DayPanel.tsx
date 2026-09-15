"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  ClipboardList,
  Leaf,
  Lock,
  LockOpen,
  PackageOpen,
  Plus,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import type { CalendarDay, CalendarLayer } from "@/lib/calendar";
import { cn, formatDateShort, formatDeliveryDate } from "@/lib/utils";
import { laneStyle } from "@/lib/lanes";
import { StatusPill } from "@/components/shared/StatusPill";
import { TASK_TYPE_ICONS, PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/tasks/constants";
import type { FarmTaskType } from "@/types/database";
import type { OrderStatus } from "@/types";
import { LAYER_META } from "./layers";

interface Props {
  day: CalendarDay;
  todayIso: string;
  layers: ReadonlySet<CalendarLayer>;
  onClose: () => void;
  /** Called after any mutation so the parent refetches the month. */
  onChanged: () => Promise<void> | void;
}

const NOTE_CATEGORIES = [
  { value: "observation", label: "Observation" },
  { value: "season_update", label: "Season Update" },
  { value: "task", label: "To-Do" },
  { value: "harvest_note", label: "Harvest Note" },
  { value: "general", label: "General" },
];

const NOTE_CATEGORY_CLASS: Record<string, string> = {
  observation: "badge-blue",
  season_update: "badge-orange",
  task: "badge-gold",
  harvest_note: "badge-green",
  general: "badge-gray",
};

const QUICK_TASK_TYPES: FarmTaskType[] = ["custom", "harvest", "sow", "maintenance", "delivery-prep"];

const DELIVERY_STATUS_CLASS: Record<string, string> = {
  pending: "badge-gray",
  logged: "badge-blue",
  finalized: "badge-green",
};

const REQUEST_STATUS_CLASS: Record<string, string> = {
  pending: "badge-gold",
  approved: "badge-green",
  accepted: "badge-green",
  declined: "badge-red",
  rejected: "badge-red",
  fulfilled: "badge-green",
};

function meta(key: CalendarLayer) {
  return LAYER_META.find((m) => m.key === key)!;
}

function SectionHeader({ layer, count, action }: { layer: CalendarLayer; count: number; action?: React.ReactNode }) {
  const m = meta(layer);
  return (
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold inline-flex items-center gap-1.5">
        <span className={cn("inline-block w-2 h-2 rounded-full", m.dot)} />
        {m.label}
        <span className="tabular-nums text-farm-muted/70">{count}</span>
      </p>
      {action}
    </div>
  );
}

/**
 * Everything that lives on one calendar day + the quick actions an admin
 * reaches for from a date: open/close ordering, tick off / snooze tasks,
 * add a task or field note, and jump to the deeper pages.
 */
export function DayPanel({ day, todayIso, layers, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [taskOpen, setTaskOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState<FarmTaskType>("custom");
  const [taskPriority, setTaskPriority] = useState<1 | 2 | 3 | 4>(2);
  const [noteText, setNoteText] = useState("");
  const [noteCategory, setNoteCategory] = useState("observation");

  const isToday = day.date === todayIso;
  const isPast = day.date < todayIso;
  const dd = day.deliveryDate;

  async function run(label: string, fn: () => Promise<Response>) {
    setBusy(label);
    setErr(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await onChanged();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const toggleOrdering = () =>
    dd &&
    run("ordering", () =>
      fetch("/api/availability/toggle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delivery_date_id: dd.id, ordering_open: !dd.orderingOpen }),
      }),
    );

  const completeTask = (id: string) =>
    run(`task:${id}`, () => fetch(`/api/tasks/${id}/complete`, { method: "POST" }));
  const reopenTask = (id: string) =>
    run(`task:${id}`, () => fetch(`/api/tasks/${id}/reopen`, { method: "POST" }));
  const snoozeTask = (id: string, days: number) =>
    run(`task:${id}`, () =>
      fetch(`/api/tasks/${id}/snooze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      }),
    );

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    const ok = await run("add-task", () =>
      fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          type: taskType,
          priority: taskPriority,
          due_date: day.date,
        }),
      }),
    );
    if (ok) {
      setTaskTitle("");
      setTaskOpen(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    const ok = await run("add-note", () =>
      fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: day.date, text: noteText.trim(), category: noteCategory }),
      }),
    );
    if (ok) {
      setNoteText("");
      setNoteOpen(false);
    }
  };

  const deleteNote = (id: string) => {
    if (!window.confirm("Delete this note?")) return;
    return run(`note:${id}`, () => fetch(`/api/notes/${id}`, { method: "DELETE" }));
  };

  const openTasks = day.tasks.filter((t) => t.status !== "completed");
  const doneTasks = day.tasks.filter((t) => t.status === "completed");
  const deliveryTotal = day.deliveries.reduce((s, d) => s + d.total, 0);
  const nothing =
    !dd &&
    day.orders.length === 0 &&
    day.deliveries.length === 0 &&
    day.tasks.length === 0 &&
    day.notes.length === 0 &&
    day.eventRequests.length === 0 &&
    day.harvest.length === 0 &&
    !day.labor;

  return (
    <section
      className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm overflow-hidden"
      aria-label={`Details for ${formatDeliveryDate(day.date)}`}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-farm-dark/5 bg-farm-cream/40">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xl text-farm-dark leading-tight">
              {formatDeliveryDate(day.date)}
              {isToday && (
                <span className="ml-2 align-middle text-[10px] tracking-[0.18em] uppercase text-farm-green font-sans font-semibold">
                  Today
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {dd ? (
                <>
                  <span className="badge-green">
                    <Leaf className="w-3 h-3 mr-1" /> Delivery day
                  </span>
                  <span className={dd.orderingOpen ? "badge-blue" : "badge-red"}>
                    {dd.orderingOpen ? "Ordering open" : "Ordering closed"}
                  </span>
                  {day.availabilityPublished ? (
                    <span className="badge-gray">Published</span>
                  ) : (
                    !isPast && <span className="badge-gold">Not published</span>
                  )}
                  {day.notified && <span className="badge-gray">Receiver notified</span>}
                </>
              ) : (
                <span className="text-xs text-farm-muted">Not a delivery day</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close day"
            className="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center text-farm-muted hover:text-farm-dark rounded-xl flex-shrink-0"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-4 gap-1.5 mt-3">
          <Link
            href={`/admin/availability/${day.date}`}
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white border border-farm-dark/10 min-h-[56px] text-[10px] font-medium text-farm-dark hover:bg-farm-cream transition-colors"
          >
            <Leaf className="w-4 h-4 text-farm-green" strokeWidth={1.75} />
            Availability
          </Link>
          <Link
            href={`/admin/orders/${day.date}`}
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white border border-farm-dark/10 min-h-[56px] text-[10px] font-medium text-farm-dark hover:bg-farm-cream transition-colors"
          >
            <ClipboardList className="w-4 h-4 text-pf-master-blue" strokeWidth={1.75} />
            Orders
          </Link>
          <Link
            href={`/admin/deliveries/${day.date}`}
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white border border-farm-dark/10 min-h-[56px] text-[10px] font-medium text-farm-dark hover:bg-farm-cream transition-colors"
          >
            <PackageOpen className="w-4 h-4 text-pf-master-orange" strokeWidth={1.75} />
            Log delivery
          </Link>
          {dd ? (
            <button
              type="button"
              onClick={toggleOrdering}
              disabled={busy === "ordering"}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl border min-h-[56px] text-[10px] font-medium transition-colors disabled:opacity-60",
                dd.orderingOpen
                  ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
                  : "bg-farm-green-light border-farm-green/20 text-farm-green hover:opacity-80",
              )}
            >
              {dd.orderingOpen ? (
                <Lock className="w-4 h-4" strokeWidth={1.75} />
              ) : (
                <LockOpen className="w-4 h-4" strokeWidth={1.75} />
              )}
              {busy === "ordering" ? "…" : dd.orderingOpen ? "Close ordering" : "Open ordering"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNoteOpen(true);
                setTaskOpen(false);
              }}
              className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white border border-farm-dark/10 min-h-[56px] text-[10px] font-medium text-farm-dark hover:bg-farm-cream transition-colors"
            >
              <StickyNote className="w-4 h-4 text-farm-muted" strokeWidth={1.75} />
              Add note
            </button>
          )}
        </div>
      </div>

      {err && (
        <p className="px-4 py-2 text-xs text-red-700 bg-red-50 border-b border-red-100">{err}</p>
      )}

      <div className="px-4 py-4 space-y-5">
        {nothing && !taskOpen && !noteOpen && (
          <p className="text-sm text-farm-muted/80 italic">Nothing scheduled. Add a task or a note below.</p>
        )}

        {/* Orders */}
        {layers.has("orders") && day.orders.length > 0 && (
          <div>
            <SectionHeader layer="orders" count={day.orders.length} />
            <ul className="space-y-1.5">
              {day.orders.map((o) => {
                const lane = laneStyle(o.restaurant);
                return (
                  <li key={o.id}>
                    <Link
                      href={`/admin/orders/${day.date}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border border-farm-dark/5 border-l-2 px-3 py-2 min-h-[44px] hover:bg-farm-cream/40 transition-colors",
                        lane.border,
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm text-farm-dark truncate", lane.nameClass)}>{o.restaurant}</span>
                        <span className="block text-[11px] text-farm-muted">
                          {o.itemCount} line{o.itemCount === 1 ? "" : "s"}
                          {o.shortedCount > 0 && ` · ${o.shortedCount} short`}
                          {o.eventName && ` · ${o.eventName}`}
                        </span>
                      </span>
                      <StatusPill status={o.status as OrderStatus} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Deliveries */}
        {layers.has("deliveries") && day.deliveries.length > 0 && (
          <div>
            <SectionHeader
              layer="deliveries"
              count={day.deliveries.length}
              action={<span className="text-xs font-semibold text-farm-dark tabular-nums">${deliveryTotal.toFixed(2)}</span>}
            />
            <ul className="space-y-1.5">
              {day.deliveries.map((d) => {
                const lane = laneStyle(d.restaurant);
                return (
                  <li key={d.id}>
                    <Link
                      href={`/admin/deliveries/${day.date}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border border-farm-dark/5 border-l-2 px-3 py-2 min-h-[44px] hover:bg-farm-cream/40 transition-colors",
                        lane.border,
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm text-farm-dark truncate", lane.nameClass)}>{d.restaurant}</span>
                        <span className="block text-[11px] text-farm-muted">
                          {d.itemCount} line{d.itemCount === 1 ? "" : "s"} · ${d.total.toFixed(2)}
                        </span>
                      </span>
                      <span className={DELIVERY_STATUS_CLASS[d.status] ?? "badge-gray"}>{d.status}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Tasks */}
        {layers.has("tasks") && (day.tasks.length > 0 || taskOpen || !nothing) && (
          <div>
            <SectionHeader
              layer="tasks"
              count={openTasks.length}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setTaskOpen((v) => !v);
                    setNoteOpen(false);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-farm-green hover:underline min-h-[32px]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              }
            />
            {taskOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addTask();
                }}
                className="rounded-xl border border-farm-green/20 bg-farm-green-light/40 p-3 space-y-2 mb-2"
              >
                <input
                  autoFocus
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="What needs doing?"
                  className="w-full rounded-lg border border-farm-dark/10 px-3 min-h-[44px] text-sm bg-white"
                  maxLength={200}
                />
                <div className="flex gap-2">
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as FarmTaskType)}
                    className="flex-1 rounded-lg border border-farm-dark/10 px-2 min-h-[40px] text-sm bg-white"
                    aria-label="Task type"
                  >
                    {QUICK_TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TASK_TYPE_ICONS[t]} {t === "custom" ? "Task" : t.replace("-", " ")}
                      </option>
                    ))}
                  </select>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(Number(e.target.value) as 1 | 2 | 3 | 4)}
                    className="flex-1 rounded-lg border border-farm-dark/10 px-2 min-h-[40px] text-sm bg-white"
                    aria-label="Priority"
                  >
                    {([1, 2, 3, 4] as const).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy === "add-task" || !taskTitle.trim()}
                    className="flex-1 btn-primary min-h-[40px] text-sm disabled:opacity-50"
                  >
                    {busy === "add-task" ? "Saving…" : `Add for ${day.date.slice(5).replace("-", "/")}`}
                  </button>
                  <button type="button" onClick={() => setTaskOpen(false)} className="btn-ghost min-h-[40px] text-sm px-3">
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {openTasks.length === 0 && doneTasks.length === 0 && !taskOpen && (
              <p className="text-xs text-farm-muted/80 italic">No tasks due.</p>
            )}
            <ul className="space-y-1.5">
              {openTasks.map((t) => {
                const pending = busy === `task:${t.id}`;
                const overdue = isPast && t.status === "open";
                return (
                  <li
                    key={t.id}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-2.5 py-2",
                      overdue ? "border-red-200 bg-red-50/40" : "border-farm-dark/5",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => completeTask(t.id)}
                      disabled={pending}
                      aria-label={`Complete ${t.title}`}
                      className="group mt-0.5 w-7 h-7 rounded-full border-2 border-farm-green/50 flex items-center justify-center text-farm-green hover:bg-farm-green hover:text-white transition-colors flex-shrink-0 disabled:opacity-50"
                    >
                      {pending ? <span className="text-[10px]">…</span> : <Check className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-farm-dark leading-snug">
                        <span className="mr-1">{TASK_TYPE_ICONS[t.type as FarmTaskType] ?? "•"}</span>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-farm-muted mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        {t.linkedName && <span>{t.linkedName}</span>}
                        {t.dueTime && <span>{t.dueTime.slice(0, 5)}</span>}
                        {t.priority !== 2 && (
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded", PRIORITY_COLORS[t.priority as 1 | 2 | 3 | 4])}>
                            {PRIORITY_LABELS[t.priority as 1 | 2 | 3 | 4]}
                          </span>
                        )}
                        {t.status === "snoozed" && <span className="badge-gray">Snoozed</span>}
                        {overdue && <span className="text-red-700 font-semibold">Overdue</span>}
                      </p>
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => snoozeTask(t.id, 1)}
                          disabled={pending}
                          className="text-[11px] text-farm-muted hover:text-farm-dark underline-offset-2 hover:underline min-h-[28px] px-1"
                        >
                          +1 day
                        </button>
                        <button
                          type="button"
                          onClick={() => snoozeTask(t.id, 7)}
                          disabled={pending}
                          className="text-[11px] text-farm-muted hover:text-farm-dark underline-offset-2 hover:underline min-h-[28px] px-1"
                        >
                          +1 week
                        </button>
                        <Link
                          href={`/admin/tasks/${t.id}/edit`}
                          className="text-[11px] text-farm-muted hover:text-farm-dark underline-offset-2 hover:underline min-h-[28px] px-1 inline-flex items-center"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </li>
                );
              })}
              {doneTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 rounded-lg border border-farm-dark/5 px-2.5 py-2 opacity-70">
                  <button
                    type="button"
                    onClick={() => reopenTask(t.id)}
                    disabled={busy === `task:${t.id}`}
                    aria-label={`Reopen ${t.title}`}
                    className="mt-0.5 w-7 h-7 rounded-full bg-farm-green text-white flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                    title="Reopen"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-sm text-farm-dark line-through leading-snug min-w-0 flex-1">{t.title}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Event requests */}
        {layers.has("events") && day.eventRequests.length > 0 && (
          <div>
            <SectionHeader
              layer="events"
              count={day.eventRequests.length}
              action={
                <Link href="/admin/event-requests" className="text-[11px] font-semibold text-farm-green hover:underline">
                  Review
                </Link>
              }
            />
            <ul className="space-y-1.5">
              {day.eventRequests.map((e) =>
                e.kind === "order" && e.deliveryDate ? (
                  <li key={e.id}>
                    <Link
                      href={`/admin/orders/${e.deliveryDate}`}
                      className="flex items-center gap-2 rounded-lg border border-farm-dark/5 border-l-2 border-l-pf-master-violet px-3 py-2 min-h-[44px] hover:bg-farm-cream/40 transition-colors"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-farm-dark truncate">{e.eventName ?? "Event order"}</span>
                        <span className="block text-[11px] text-farm-muted truncate">
                          {e.restaurant} · {e.itemName} · delivers {formatDateShort(e.deliveryDate)}
                        </span>
                      </span>
                      <StatusPill status={e.status as OrderStatus} />
                    </Link>
                  </li>
                ) : (
                  <li key={e.id} className="flex items-center gap-2 rounded-lg border border-farm-dark/5 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-farm-dark truncate">
                        {e.quantity} {e.unit} {e.itemName}
                      </span>
                      <span className="block text-[11px] text-farm-muted truncate">
                        {e.restaurant}
                        {e.eventName && ` · ${e.eventName}`} · request
                      </span>
                    </span>
                    <span className={REQUEST_STATUS_CLASS[e.status] ?? "badge-gray"}>{e.status}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

        {/* Harvest forecast */}
        {layers.has("harvest") && day.harvest.length > 0 && (
          <div>
            <SectionHeader layer="harvest" count={day.harvest.length} />
            <ul className="space-y-1">
              {day.harvest.map((h, i) => (
                <li key={`${h.refId}-${h.type}-${i}`} className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
                      h.source === "field" ? "bg-pf-master-orange" : "bg-blue-500",
                    )}
                  />
                  <span className="text-farm-dark min-w-0 truncate">{h.name}</span>
                  <span className="text-[11px] text-farm-muted ml-auto flex-shrink-0">{h.label.split(":")[0]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Labor */}
        {layers.has("labor") && day.labor && (
          <div>
            <SectionHeader
              layer="labor"
              count={day.labor.entries}
              action={
                <Link href="/admin/labor" className="text-[11px] font-semibold text-farm-green hover:underline">
                  Timesheet
                </Link>
              }
            />
            <p className="text-sm text-farm-dark">
              <span className="font-semibold tabular-nums">{day.labor.hours}h</span>
              <span className="text-farm-muted"> · {day.labor.workers.join(", ")}</span>
            </p>
          </div>
        )}

        {/* Notes */}
        {layers.has("notes") && (day.notes.length > 0 || noteOpen || !nothing) && (
          <div>
            <SectionHeader
              layer="notes"
              count={day.notes.length}
              action={
                <button
                  type="button"
                  onClick={() => {
                    setNoteOpen((v) => !v);
                    setTaskOpen(false);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-farm-green hover:underline min-h-[32px]"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              }
            />
            {noteOpen && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addNote();
                }}
                className="rounded-xl border border-farm-dark/10 bg-farm-cream/40 p-3 space-y-2 mb-2"
              >
                <textarea
                  autoFocus
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="What did you see in the field?"
                  rows={3}
                  className="w-full rounded-lg border border-farm-dark/10 px-3 py-2 text-sm bg-white"
                  maxLength={2000}
                />
                <div className="flex gap-2">
                  <select
                    value={noteCategory}
                    onChange={(e) => setNoteCategory(e.target.value)}
                    className="flex-1 rounded-lg border border-farm-dark/10 px-2 min-h-[40px] text-sm bg-white"
                    aria-label="Note category"
                  >
                    {NOTE_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={busy === "add-note" || !noteText.trim()}
                    className="btn-primary min-h-[40px] text-sm px-4 disabled:opacity-50"
                  >
                    {busy === "add-note" ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => setNoteOpen(false)} className="btn-ghost min-h-[40px] text-sm px-3">
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {day.notes.length === 0 && !noteOpen && (
              <p className="text-xs text-farm-muted/80 italic">No notes.</p>
            )}
            <ul className="space-y-1.5">
              {day.notes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 rounded-lg border border-farm-dark/5 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-farm-dark whitespace-pre-wrap leading-snug">{n.text}</p>
                    <span className={cn("mt-1 inline-block", NOTE_CATEGORY_CLASS[n.category] ?? "badge-gray")}>
                      {NOTE_CATEGORIES.find((c) => c.value === n.category)?.label ?? n.category}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNote(n.id)}
                    disabled={busy === `note:${n.id}`}
                    aria-label="Delete note"
                    className="w-9 h-9 -mr-1 flex items-center justify-center text-farm-muted hover:text-red-600 rounded-lg flex-shrink-0 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
