"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDaysISO } from "@/lib/utils";
import { TASK_TYPE_ICONS } from "@/lib/tasks/constants";
import { localizeTaskDescription, localizeTaskTitle } from "@/lib/tasks/localize";
import { HARVEST_STRINGS, formatHarvestDate, type HarvestLang } from "@/lib/i18n/harvest";
import type { BoardTask } from "@/lib/tasks/board";

/** A farm task as the portal sees it — shared shape, see src/lib/tasks/board.ts. */
export type FarmHandTask = BoardTask;

interface Props {
  lang: HarvestLang;
  today: string; // Pacific YYYY-MM-DD
  todayTasks: FarmHandTask[];
  upcomingTasks: FarmHandTask[];
  doneTasks: FarmHandTask[];
  /** The signed-in person — "My tasks" = assigned to them, or to anyone. */
  meId: string;
}

/**
 * Farm-hand task list — the Tasks tab of /harvest. Every open farm task
 * (what's due now, what's coming up) with its photos, in English or
 * Spanish; one big button marks a task finished, "Undo" on the finished
 * list takes it back. Creating / editing tasks stays on /admin/tasks.
 */
export function FarmTasks({ lang, today, todayTasks, upcomingTasks, doneTasks, meId }: Props) {
  const t = HARVEST_STRINGS[lang];
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Optimistic: ids finished / reopened here, until the refresh lands.
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  const [justReopened, setJustReopened] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Fresh server data replaces the optimistic overlay.
  useEffect(() => {
    setJustDone(new Set());
    setJustReopened(new Set());
  }, [todayTasks, upcomingTasks, doneTasks]);

  // The list changes during the day (Micheal adds tasks) — refresh when the
  // phone comes back to the page so it's never stale.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  async function act(id: string, action: "complete" | "reopen") {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${id}/${action}`, { method: "POST" });
      // 409 = someone else already finished / reopened it; just resync.
      if (!res.ok && res.status !== 409) throw new Error();
      if (action === "complete") setJustDone((s) => new Set(s).add(id));
      else setJustReopened((s) => new Set(s).add(id));
      router.refresh();
    } catch {
      setError(t.taskSaveFailed);
    } finally {
      setBusyId(null);
    }
  }

  // "My tasks" (default): mine + the ones for anyone. "Everyone's" shows the
  // whole farm, each card naming who it belongs to.
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const inScope = (x: FarmHandTask) =>
    scope === "all" || x.assignee_id === null || x.assignee_id === meId;
  const openToday = todayTasks.filter((x) => !justDone.has(x.id) && inScope(x));
  const openUpcoming = upcomingTasks.filter((x) => !justDone.has(x.id) && inScope(x));
  const done = doneTasks.filter((x) => !justReopened.has(x.id));

  // Upcoming, grouped by day.
  const byDate = new Map<string, FarmHandTask[]>();
  for (const task of openUpcoming) {
    byDate.set(task.due_date, [...(byDate.get(task.due_date) ?? []), task]);
  }
  const tomorrow = addDaysISO(today, 1);
  const dateHeading = (d: string) =>
    d === tomorrow ? `${t.taskTomorrow} · ${formatHarvestDate(d, lang)}` : formatHarvestDate(d, lang);

  const cardProps = { lang, today, busyId, onPhoto: setLightbox };

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={t.taskShowing}>
        {(["mine", "all"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setScope(key)}
            aria-pressed={scope === key}
            className={cn(
              "min-h-[44px] rounded-xl border text-sm font-semibold transition-colors",
              scope === key
                ? "bg-farm-dark text-white border-farm-dark"
                : "bg-white text-farm-dark/80 border-farm-dark/10 hover:border-farm-dark/30",
            )}
          >
            {key === "mine" ? t.taskMine : t.taskEveryone}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <section aria-labelledby="tasks-today">
        <h2 id="tasks-today" className="text-xs font-bold uppercase tracking-wider text-farm-muted mb-2">
          {t.tasksToday}
          {openToday.length > 0 && <span className="text-farm-dark"> · {openToday.length}</span>}
        </h2>
        {openToday.length === 0 ? (
          <div className="text-center py-8">
            <Image src="/assets/pressfarm/flowers/pea-flower.png" alt="" aria-hidden="true" width={96} height={96} sizes="80px" className="mx-auto h-20 w-auto mb-3" />
            <p className="text-base font-semibold text-farm-dark">{t.tasksNoneToday}</p>
            <p className="text-sm text-farm-muted mt-1 max-w-sm mx-auto">{t.tasksNoneTodayHint}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {openToday.map((task) => (
              <TaskCard key={task.id} task={task} {...cardProps} onAction={() => act(task.id, "complete")} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tasks-upcoming">
        <h2 id="tasks-upcoming" className="text-xs font-bold uppercase tracking-wider text-farm-muted mb-2">
          {t.tasksUpcoming}
          {openUpcoming.length > 0 && <span className="text-farm-dark"> · {openUpcoming.length}</span>}
        </h2>
        {openUpcoming.length === 0 ? (
          <p className="text-sm text-farm-muted">{t.tasksNoneUpcoming}</p>
        ) : (
          <div className="space-y-4">
            {Array.from(byDate.keys()).sort().map((d) => (
              <div key={d}>
                <h3 className="text-sm font-semibold text-farm-dark capitalize mb-2">{dateHeading(d)}</h3>
                <ul className="space-y-3">
                  {byDate.get(d)!.map((task) => (
                    <TaskCard key={task.id} task={task} {...cardProps} onAction={() => act(task.id, "complete")} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="tasks-done">
        <h2 id="tasks-done" className="text-xs font-bold uppercase tracking-wider text-farm-muted mb-2">
          {t.tasksDone}
          {done.length > 0 && <span className="text-farm-dark"> · {done.length}</span>}
        </h2>
        {done.length === 0 ? (
          <p className="text-sm text-farm-muted">{t.tasksNoneDone}</p>
        ) : (
          <ul className="space-y-2">
            {done.map((task) => (
              <TaskCard key={task.id} task={task} {...cardProps} variant="done" onAction={() => act(task.id, "reopen")} />
            ))}
          </ul>
        )}
      </section>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.taskPhoto}
          className="fixed inset-0 z-50 bg-farm-dark/95 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <div className="relative w-full h-full">
            <Image src={lightbox} alt={t.taskPhoto} fill sizes="100vw" className="object-contain" />
          </div>
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label={t.taskClosePhoto}
            className="absolute top-3 right-3 w-12 h-12 rounded-full bg-white text-farm-dark flex items-center justify-center shadow"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  lang,
  today,
  busyId,
  variant = "open",
  onAction,
  onPhoto,
}: {
  task: FarmHandTask;
  lang: HarvestLang;
  today: string;
  busyId: string | null;
  variant?: "open" | "done";
  onAction: () => void;
  onPhoto: (url: string) => void;
}) {
  const t = HARVEST_STRINGS[lang];
  const title = localizeTaskTitle(task, lang);
  const description = localizeTaskDescription(task, lang);
  const isDone = variant === "done";
  const overdue = !isDone && task.due_date < today;
  const busy = busyId === task.id;

  const meta: string[] = [t.taskTypeLabels[task.type] ?? task.type];
  if (task.subject) meta.push(task.subject);
  if (task.due_time) meta.push(task.due_time.slice(0, 5));

  return (
    <li className={cn("card p-4", isDone && "opacity-80")}>
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none mt-0.5 flex-shrink-0" aria-hidden="true">
          {isDone ? "✓" : TASK_TYPE_ICONS[task.type]}
        </span>
        <div className="flex-1 min-w-0">
          <p className={cn("text-base font-semibold text-farm-dark leading-snug", isDone && "line-through decoration-farm-muted/60")}>
            {title}
          </p>
          <p className="text-xs text-farm-muted mt-0.5">{meta.join(" · ")}</p>
          {!isDone && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="badge-blue text-[11px] px-2 py-0.5 rounded">
                {task.assignee_name ?? t.taskAnyone}
              </span>
              {overdue && (
                <span className="badge-red text-[11px] px-2 py-0.5 rounded">
                  {t.taskOverdue} · {formatHarvestDate(task.due_date, lang)}
                </span>
              )}
              {!isDone && task.priority === 1 && (
                <span className="badge-red text-[11px] px-2 py-0.5 rounded">{t.taskUrgent}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {!isDone && description && (
        <p className="text-sm text-farm-dark/90 whitespace-pre-wrap leading-relaxed mt-3">{description}</p>
      )}

      {!isDone && task.photo_urls.length > 0 && (
        <ul className={cn("grid gap-2 mt-3", task.photo_urls.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {task.photo_urls.map((url) => (
            <li key={url}>
              <button
                type="button"
                onClick={() => onPhoto(url)}
                aria-label={t.taskPhoto}
                className={cn(
                  "relative block w-full rounded-xl overflow-hidden border border-farm-dark/10 bg-farm-cream",
                  task.photo_urls.length === 1 ? "aspect-[4/3]" : "aspect-square",
                )}
              >
                <Image src={url} alt={t.taskPhoto} fill sizes="(max-width: 768px) 100vw, 720px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {isDone ? (
        <div className="flex items-center justify-between gap-3 mt-2">
          <p className="text-xs text-farm-muted min-w-0 truncate">
            {task.completed_at ? formatHarvestDate(task.completed_at.slice(0, 10), lang) : ""}
            {task.completed_by_name ? ` · ${t.taskDoneBy} ${task.completed_by_name}` : ""}
          </p>
          <button
            type="button"
            onClick={onAction}
            disabled={busy}
            className="flex-shrink-0 min-h-[44px] px-3 rounded-lg text-sm font-medium text-farm-dark border border-farm-dark/15 bg-white hover:bg-farm-cream/60 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" /> {t.taskUndo}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAction}
          disabled={busy}
          aria-label={`${t.taskDoneAria}: ${title}`}
          className="mt-3 w-full min-h-[48px] rounded-xl bg-farm-green text-white text-base font-semibold hover:bg-farm-green/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" aria-hidden="true" /> {busy ? "…" : t.taskMarkDone}
        </button>
      )}
    </li>
  );
}
