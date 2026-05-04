"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Target {
  id: string;
  name: string;
  category: string;
}

type Status = "updated" | "skipped" | "error";

interface ResultEntry {
  id: string;
  name: string;
  status: Status;
  updated_fields?: string[];
  skip_reason?: string;
  error?: string;
}

const BATCH_SIZE = 30;

/**
 * Drives the bulk-fill flow: walks the list of fillable items in
 * BATCH_SIZE chunks, posting each to /api/ai/bulk-fill-items, and
 * surfaces real-time progress + per-item results. The server applies
 * each item's update to the database before responding for that
 * batch, so a stop mid-run leaves earlier items already updated.
 *
 * Stop is honored between batches, not mid-batch — Haiku calls fan out
 * server-side and we don't propagate cancellation. Practically the
 * gap is at most ~10s.
 */
export function BulkFillClient({
  targets,
  alreadyFilledCount,
}: {
  targets: Target[];
  alreadyFilledCount: number;
}) {
  const [running, setRunning] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const total = targets.length;
  const counts = useMemo(() => {
    const out = { updated: 0, skipped: 0, error: 0 };
    for (const r of results) {
      out[r.status]++;
    }
    return out;
  }, [results]);

  async function start() {
    setRunning(true);
    setStopRequested(false);
    setCompleted(0);
    setResults([]);
    setBatchError(null);
    setDone(false);

    let stopFlag = false;
    // Snapshot pattern — when the user clicks Stop, the React state
    // update is async; we read the latest value before each batch via
    // a closure-local flag flipped by the Stop button's onClick. But
    // since this runs in a loop in a different tick, we re-read state
    // through a wrapper. Simpler: check stopRequested via a ref-like
    // closure. Use a local mutable since closures over state are
    // stale.
    const checkStop = () => stopFlag;

    const batches: Target[][] = [];
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      batches.push(targets.slice(i, i + BATCH_SIZE));
    }

    // The Stop button writes to this via a side-effect; we read here.
    (window as any).__bulkFillStop = () => {
      stopFlag = true;
      setStopRequested(true);
    };

    let completedSoFar = 0;
    for (const batch of batches) {
      if (checkStop()) break;
      try {
        const res = await fetch("/api/ai/bulk-fill-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: batch.map((b) => b.id) }),
        });
        const json = await res.json();
        if (!res.ok) {
          setBatchError(json.error ?? `Batch failed (${res.status})`);
          break;
        }
        const newResults: ResultEntry[] = json.results ?? [];
        completedSoFar += batch.length;
        setResults((prev) => [...prev, ...newResults]);
        setCompleted(completedSoFar);
      } catch (err: any) {
        setBatchError(err?.message ?? "Network error");
        break;
      }
    }

    delete (window as any).__bulkFillStop;
    setRunning(false);
    setDone(true);
  }

  function requestStop() {
    const stopper = (window as any).__bulkFillStop;
    if (typeof stopper === "function") stopper();
  }

  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-4">
      {/* Up-front breakdown — what the run will do before they start */}
      <div className="bg-white rounded-2xl border border-pf-master-violet/15 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-pf-master-violet/[0.04] border-b border-pf-master-violet/10">
          <p className="section-eyebrow text-pf-master-violet">Bulk AI Fill</p>
          <p className="text-xs text-farm-muted mt-1 leading-snug">
            Runs Claude Haiku 4.5 on every item with at least one empty content field, filling chef notes, growing notes, season note, days to maturity, sun, sow method, sow depth, and plant spacing. Only fills empty fields — admin-entered values are never overwritten. Calibrated to Johnny&apos;s Selected Seeds standards.
          </p>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat label="Will process" value={total} tone="violet" />
          <Stat label="Already filled" value={alreadyFilledCount} tone="muted" />
          <Stat label="Est. cost" value={`~$${(total * 0.001).toFixed(2)}`} tone="muted" />
        </div>
        <div className="px-5 pb-5 flex items-center gap-3">
          {!running && !done && (
            <button
              type="button"
              onClick={start}
              disabled={total === 0}
              className="text-sm font-medium px-4 py-2.5 rounded-lg bg-pf-master-violet text-white hover:bg-pf-master-violet/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              <span aria-hidden="true">✨</span>
              <span>Start ({total} items)</span>
            </button>
          )}
          {running && (
            <button
              type="button"
              onClick={requestStop}
              disabled={stopRequested}
              className="text-sm font-medium px-4 py-2.5 rounded-lg border border-farm-dark/15 text-farm-dark bg-white hover:bg-farm-cream/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stopRequested ? "Stopping after current batch…" : "Stop"}
            </button>
          )}
          {done && (
            <>
              <button
                type="button"
                onClick={start}
                className="text-sm font-medium px-4 py-2.5 rounded-lg border border-farm-dark/15 text-farm-dark bg-white hover:bg-farm-cream/40"
              >
                Run again
              </button>
              <Link
                href="/admin/items"
                className="text-sm font-medium px-4 py-2.5 rounded-lg bg-farm-green text-white hover:bg-farm-green-dark"
              >
                Back to catalog
              </Link>
            </>
          )}
          <p className="text-[11px] text-farm-muted ml-auto">
            ~30 items per request · Haiku 4.5
          </p>
        </div>
      </div>

      {/* Live progress — only visible once a run has started */}
      {(running || done) && (
        <div className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-farm-dark/5">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <p className="text-sm font-semibold text-farm-dark">
                {done ? "Run complete" : "Processing…"}
              </p>
              <p className="text-xs text-farm-muted">
                {completed} / {total} ({progress}%)
              </p>
            </div>
            <div className="h-2 bg-farm-cream/60 rounded-full overflow-hidden">
              <div
                className={`h-full transition-[width] duration-300 ${
                  done && counts.error === 0 ? "bg-farm-green" : "bg-pf-master-violet"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <span className="text-farm-green">
                <span className="font-semibold">{counts.updated}</span> updated
              </span>
              <span className="text-farm-muted">
                <span className="font-semibold">{counts.skipped}</span> skipped
              </span>
              <span className={counts.error > 0 ? "text-red-700" : "text-farm-muted"}>
                <span className="font-semibold">{counts.error}</span> errored
              </span>
            </div>
            {batchError && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs text-red-700">{batchError}</p>
              </div>
            )}
          </div>

          {/* Per-item results — newest at the top so progress is visible */}
          {results.length > 0 && (
            <ul className="divide-y divide-farm-dark/5 max-h-[60vh] overflow-y-auto">
              {[...results].reverse().map((r, i) => (
                <li key={`${r.id}-${i}`} className="px-5 py-2.5 flex items-start gap-3">
                  <StatusBadge status={r.status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-farm-dark truncate">{r.name}</p>
                    {r.status === "updated" && r.updated_fields && (
                      <p className="text-[11px] text-farm-muted mt-0.5">
                        Filled: {r.updated_fields.join(", ")}
                      </p>
                    )}
                    {r.status === "skipped" && r.skip_reason && (
                      <p className="text-[11px] text-farm-muted mt-0.5">{r.skip_reason}</p>
                    )}
                    {r.status === "error" && r.error && (
                      <p className="text-[11px] text-red-700 mt-0.5">{r.error}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {total === 0 && !running && !done && (
        <div className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm px-5 py-8 text-center">
          <p className="text-sm text-farm-dark">
            Every active item already has all content fields filled.
          </p>
          <p className="text-xs text-farm-muted mt-1">Nothing to do.</p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "violet" | "muted";
}) {
  return (
    <div>
      <p className="text-[10px] tracking-wider uppercase text-farm-muted/80">{label}</p>
      <p
        className={`mt-1 font-display text-2xl ${tone === "violet" ? "text-pf-master-violet" : "text-farm-dark"}`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "updated") {
    return (
      <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-farm-green/15 text-farm-green flex items-center justify-center text-[10px] font-bold">
        ✓
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-farm-cream text-farm-muted flex items-center justify-center text-[10px] font-bold">
        —
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-bold">
      !
    </span>
  );
}
