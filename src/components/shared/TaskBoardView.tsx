import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import type { BoardTask, TaskBoard } from "@/lib/tasks/board";
import { TASK_TYPE_ICONS, TASK_TYPE_LABELS } from "@/lib/tasks/constants";
import { localizeTaskDescription, localizeTaskTitle } from "@/lib/tasks/localize";
import { formatDeliveryDate } from "@/lib/utils";
import { ANYONE_LABEL, summarizeWorkload } from "@/lib/tasks/assign";
import { formatLocation } from "@/lib/tasks/location";
import { TaskActionButton } from "./TaskActionButton";

/**
 * Read-only farm task board — what needs doing, what's coming, what was
 * accomplished. Used by the Farm Liaison (/liaison/tasks) and the Receiver
 * (/receiver/tasks). `bilingual` prints the Spanish the farm hands read
 * under each English line, so the receiver can translate for the crew.
 *
 * Finishing tasks happens on the Farm Hand portal (/harvest) or
 * /admin/tasks — nothing here writes.
 */
export function TaskBoardView({
  board,
  today,
  bilingual = false,
  whoHasWhat = false,
  canComplete = false,
}: {
  board: TaskBoard;
  today: string;
  bilingual?: boolean;
  /** Adds the per-person summary card at the top (Farm Liaison). */
  whoHasWhat?: boolean;
  /** Shows Finished / Undo buttons (Head Farm Hand). Read-only without it. */
  canComplete?: boolean;
}) {
  const workload = whoHasWhat ? summarizeWorkload(board.todo, board.upcoming) : [];
  const byDate = new Map<string, BoardTask[]>();
  for (const t of board.upcoming) byDate.set(t.due_date, [...(byDate.get(t.due_date) ?? []), t]);

  return (
    <div className="space-y-8">
      {whoHasWhat && workload.length > 0 && (
        <section aria-labelledby="board-who" className="card p-4">
          <h2 id="board-who" className="section-eyebrow text-farm-muted mb-2">Who has what</h2>
          <ul className="divide-y divide-farm-dark/5">
            {workload.map((w) => (
              <li key={w.id ?? "anyone"} className="py-2.5 flex items-baseline justify-between gap-3">
                <span className="text-base font-semibold text-farm-dark">{w.name}</span>
                <span className="text-sm text-farm-muted tabular-nums text-right">
                  <span className={w.todo > 0 ? "font-semibold text-farm-dark" : ""}>{w.todo} to do now</span>
                  {" · "}
                  {w.upcoming} coming up
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="board-todo">
        <SectionHeading id="board-todo" label="Needs to be done" count={board.todo.length} />
        {board.todo.length === 0 ? (
          <p className="card p-4 text-sm text-farm-muted">Nothing waiting right now — everything due is finished.</p>
        ) : (
          <ul className="space-y-3">
            {board.todo.map((t) => (
              <TaskRow key={t.id} task={t} today={today} bilingual={bilingual} canComplete={canComplete} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="board-upcoming">
        <SectionHeading id="board-upcoming" label="Coming up" count={board.upcoming.length} />
        {board.upcoming.length === 0 ? (
          <p className="card p-4 text-sm text-farm-muted">Nothing scheduled for the next two weeks.</p>
        ) : (
          <div className="space-y-4">
            {Array.from(byDate.keys()).sort().map((d) => (
              <div key={d}>
                <h3 className="text-sm font-semibold text-farm-dark mb-2">{formatDeliveryDate(d)}</h3>
                <ul className="space-y-3">
                  {byDate.get(d)!.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} bilingual={bilingual} canComplete={canComplete} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="board-done">
        <SectionHeading id="board-done" label="Accomplished" count={board.done.length} />
        {board.done.length === 0 ? (
          <p className="card p-4 text-sm text-farm-muted">Nothing finished in this period yet.</p>
        ) : (
          <ul className="space-y-2">
            {board.done.map((t) => (
              <TaskRow key={t.id} task={t} today={today} bilingual={bilingual} canComplete={canComplete} done />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHeading({ id, label, count }: { id: string; label: string; count: number }) {
  return (
    <h2 id={id} className="section-eyebrow text-farm-muted mb-2">
      {label}
      {count > 0 && <span className="text-farm-dark"> · {count}</span>}
    </h2>
  );
}

function TaskRow({
  task,
  today,
  bilingual,
  canComplete,
  done = false,
}: {
  task: BoardTask;
  today: string;
  bilingual: boolean;
  canComplete: boolean;
  done?: boolean;
}) {
  const en = { title: localizeTaskTitle(task, "en"), description: localizeTaskDescription(task, "en") };
  const es = { title: localizeTaskTitle(task, "es"), description: localizeTaskDescription(task, "es") };
  const overdue = !done && task.due_date < today;
  const meta = [
    TASK_TYPE_LABELS[task.type],
    task.subject,
    task.stage_index && task.stage_count && task.stage_count > 1
      ? `Step ${task.stage_index} of ${task.stage_count}`
      : null,
    task.due_time?.slice(0, 5),
  ].filter(Boolean);

  return (
    <li className="card p-4">
      <div className="flex items-start gap-3">
        {done ? (
          <CheckCircle2 className="w-6 h-6 text-farm-green flex-shrink-0 mt-0.5" aria-label="Finished" />
        ) : (
          <span className="text-xl leading-none mt-0.5 flex-shrink-0" aria-hidden="true">
            {TASK_TYPE_ICONS[task.type]}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-farm-dark leading-snug">{en.title}</p>
          {bilingual && es.title !== en.title && (
            <p lang="es" className="text-sm text-pf-master-blue leading-snug mt-0.5">
              {es.title}
            </p>
          )}
          {!done && formatLocation(task) && (
            <p className="text-sm font-medium text-farm-green mt-1">
              {formatLocation(task)}
              {bilingual && formatLocation(task, "es") !== formatLocation(task) && (
                <span lang="es" className="text-pf-master-blue font-normal"> · {formatLocation(task, "es")}</span>
              )}
            </p>
          )}
          <p className="text-xs text-farm-muted mt-1">{meta.join(" · ")}</p>

          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {!done && (
              <span className="badge-blue text-[11px] px-2 py-0.5 rounded">
                {task.assignee_names.length > 0 ? task.assignee_names.join(", ") : ANYONE_LABEL}
              </span>
            )}
            {done ? (
              <span className="badge-green text-[11px] px-2 py-0.5 rounded">
                Finished {task.completed_at ? formatDeliveryDate(task.completed_at.slice(0, 10)) : ""}
                {task.completed_by_name ? ` · ${task.completed_by_name}` : ""}
              </span>
            ) : overdue ? (
              <span className="badge-red text-[11px] px-2 py-0.5 rounded">
                Overdue · was due {formatDeliveryDate(task.due_date)}
              </span>
            ) : task.due_date === today ? (
              <span className="badge-gold text-[11px] px-2 py-0.5 rounded">Due today</span>
            ) : null}
            {!done && task.priority === 1 && (
              <span className="badge-red text-[11px] px-2 py-0.5 rounded">Urgent</span>
            )}
          </div>

          {!done && en.description && (
            <p className="text-sm text-farm-dark/90 whitespace-pre-wrap leading-relaxed mt-2">{en.description}</p>
          )}
          {!done && bilingual && es.description && es.description !== en.description && (
            <p lang="es" className="text-sm text-pf-master-blue whitespace-pre-wrap leading-relaxed mt-1.5">
              {es.description}
            </p>
          )}

          {!done && task.photo_urls.length > 0 && (
            <ul className="flex gap-2 overflow-x-auto mt-3">
              {task.photo_urls.map((url) => (
                <li key={url} className="flex-shrink-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open task photo"
                    className="block relative w-28 h-28 rounded-xl overflow-hidden border border-farm-dark/10 bg-farm-cream"
                  >
                    <Image src={url} alt="Task photo" fill sizes="112px" className="object-cover" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          {canComplete && <TaskActionButton taskId={task.id} action={done ? "reopen" : "complete"} />}
        </div>
      </div>
    </li>
  );
}
