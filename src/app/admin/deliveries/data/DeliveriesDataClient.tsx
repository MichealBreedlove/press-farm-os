"use client";

import { useState, useRef, useCallback } from "react";
import { todayPacific } from "@/lib/utils";

type Tab = "export" | "import";

interface PreviewResult {
  deliveries?: number;
  lines?: number;
  skipped: number;
  sample?: { key: string; items: { item: string; qty: number; unit: string; price: number }[] }[];
  format?: "legacy-delivery-tracker" | "deliveries-csv";
  skippedRows?: { row: number; reason: string }[];
}

interface ImportResult {
  importedDeliveries?: number;
  importedLines?: number;
  lineErrors?: number;
  skipped: number;
  format?: "legacy-delivery-tracker" | "deliveries-csv";
  unknownItems?: string[];
  unknownRestaurants?: string[];
}

interface Props {
  deliveryCount: number;
  lineCount: number;
}

export function DeliveriesDataClient({ deliveryCount, lineCount }: Props) {
  const [tab, setTab] = useState<Tab>("export");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Danger zone — typed-confirmation modal for "delete all deliveries".
  // The catch is that deliveries are the financial source of truth, so
  // we want a confirmation gate beyond a one-tap modal: user must type
  // the literal word DELETE before the destructive button enables.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<null | { deleted: number; totalValueDeleted: number }>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      reset();
      setFile(dropped);
    }
  }, []);

  async function runPreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/deliveries-csv?preview=true", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Preview failed");
      setPreview(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function runImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/import/deliveries-csv?preview=false", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setResult(json);
      setPreview(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Wipe-all flow. Safety net beyond the typed-confirmation modal: the
  // server re-checks { confirm: "DELETE" } in the body, so a misclick
  // from a stale tab still can't fire this off without the literal token.
  async function runDeleteAll() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/deliveries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "all", confirm: "DELETE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      setDeleteResult({
        deleted: json.deleted ?? 0,
        totalValueDeleted: json.totalValueDeleted ?? 0,
      });
      setConfirmOpen(false);
      setConfirmText("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-farm-dark/5 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">Deliveries</p>
          <p className="font-display text-3xl text-farm-dark mt-1">{deliveryCount}</p>
          <p className="text-xs text-farm-muted mt-0.5">on record</p>
        </div>
        <div className="bg-white border border-farm-dark/5 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">Line Items</p>
          <p className="font-display text-3xl text-farm-dark mt-1">{lineCount}</p>
          <p className="text-xs text-farm-muted mt-0.5">across all deliveries</p>
        </div>
      </div>

      {/* Tab strip */}
      <div className="bg-white rounded-2xl border border-farm-dark/5 p-1 shadow-sm flex gap-1">
        <button
          type="button"
          onClick={() => setTab("export")}
          className={`flex-1 min-h-[44px] rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            tab === "export" ? "bg-farm-green text-white shadow-sm" : "text-farm-muted hover:bg-farm-cream/40"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
        <button
          type="button"
          onClick={() => setTab("import")}
          className={`flex-1 min-h-[44px] rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            tab === "import" ? "bg-farm-green text-white shadow-sm" : "text-farm-muted hover:bg-farm-cream/40"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v9a3 3 0 01-3 3H7a3 3 0 01-3-3V8m12 4l-4-4m0 0l-4 4m4-4v12" />
          </svg>
          Import
        </button>
      </div>

      {/* EXPORT TAB */}
      {tab === "export" && (
        <div className="bg-white rounded-2xl border border-farm-dark/5 overflow-hidden shadow-sm">
          <div className="px-5 pt-5 pb-3 bg-gradient-to-br from-farm-green/8 to-farm-cream/40 border-b border-farm-dark/5">
            <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green/80 font-semibold">CSV Snapshot</p>
            <p className="font-display text-xl text-farm-dark mt-1">Download delivery history</p>
            <p className="text-sm text-farm-muted mt-1.5 leading-relaxed">
              One row per fulfilled line item, joined with delivery date + restaurant + item name.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold mb-1.5 block">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full border border-farm-dark/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <div>
                <label className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold mb-1.5 block">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full border border-farm-dark/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
            </div>
            {(from || to) && (
              <button type="button" onClick={() => { setFrom(""); setTo(""); }} className="text-xs text-farm-muted hover:text-farm-green">
                Clear date range
              </button>
            )}

            <div className="rounded-xl border border-farm-dark/5 overflow-hidden">
              <div className="bg-farm-cream/40 px-3 py-2 border-b border-farm-dark/5">
                <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold">Columns</p>
              </div>
              <div className="px-3 py-2.5 flex flex-wrap gap-1">
                {["Date", "Restaurant", "Item", "Quantity", "Unit", "Unit Price", "Line Total", "Status", "Notes"].map((col) => (
                  <span key={col} className="text-[10px] bg-farm-cream/60 text-farm-dark/80 px-2 py-0.5 rounded">{col}</span>
                ))}
              </div>
            </div>

            <a
              href={`/api/deliveries/export${(from || to) ? `?${new URLSearchParams({ ...(from && { from }), ...(to && { to }) }).toString()}` : ""}`}
              className="w-full min-h-[52px] bg-farm-green text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-farm-dark transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download {from || to ? "filtered" : "all"} delivery lines
            </a>

            <p className="text-[11px] text-farm-muted text-center">
              File: <code className="font-pf-mono bg-farm-cream/60 px-1.5 py-0.5 rounded">press-farm-deliveries-{todayPacific()}.csv</code>
            </p>
          </div>
        </div>
      )}

      {/* IMPORT TAB */}
      {tab === "import" && (<>

      {/* Helper banner */}
      <div className="bg-gradient-to-br from-blue-50 to-farm-cream/30 border border-blue-100 rounded-2xl p-4">
        <p className="text-[10px] tracking-[0.18em] uppercase text-blue-700/80 font-semibold">Two formats accepted</p>
        <p className="text-sm text-farm-dark mt-1.5 leading-relaxed">
          Drop the export CSV from the tab above to round-trip edits, <em>or</em> drop your
          original <em>Daily Delivery Tracking Sheet</em> — we&apos;ll detect the
          <strong> DELIVERY TRACKER</strong> tab automatically.
        </p>
        <p className="text-xs text-farm-muted/80 mt-2 leading-relaxed">
          Either way: rows are grouped by date + restaurant. If a delivery already exists for that
          pair, its line items are wiped and re-inserted from the file. Items not in your catalog are
          skipped with a warning — import items first via the items page.
        </p>
      </div>

      {/* File picker / drop zone */}
      {!file && !result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`bg-white rounded-2xl border-2 border-dashed transition-colors p-8 text-center cursor-pointer ${
            dragOver ? "border-farm-green bg-farm-green/5" : "border-farm-dark/15 hover:border-farm-green/40"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={(e) => { reset(); setFile(e.target.files?.[0] ?? null); }}
          />
          <div className="w-14 h-14 mx-auto rounded-2xl bg-farm-green/10 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-farm-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v9a3 3 0 01-3 3H7a3 3 0 01-3-3V8m12 4l-4-4m0 0l-4 4m4-4v12" />
            </svg>
          </div>
          <p className="font-display text-lg text-farm-dark">Drop your file here</p>
          <p className="text-sm text-farm-muted mt-1">.csv or .xlsx — both formats auto-detected</p>
        </div>
      )}

      {/* Selected file card */}
      {file && !result && (
        <div className="bg-white rounded-2xl border border-farm-dark/5 p-4 shadow-sm flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-farm-green/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-farm-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-farm-dark truncate">{file.name}</p>
            <p className="text-xs text-farm-muted">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <button type="button" onClick={reset} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-farm-muted hover:text-farm-dark" aria-label="Remove file">
            ✕
          </button>
        </div>
      )}

      {/* Action buttons */}
      {file && !preview && !result && (
        <div className="flex gap-3">
          <button
            onClick={runPreview}
            disabled={loading}
            className="flex-1 min-h-[48px] bg-white border border-farm-dark/15 text-farm-dark/85 rounded-xl text-sm font-semibold disabled:opacity-50 hover:border-farm-green hover:text-farm-green transition-colors"
          >
            {loading ? "Parsing…" : "Preview First"}
          </button>
          <button
            onClick={runImport}
            disabled={loading}
            className="flex-1 min-h-[48px] bg-farm-green text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-farm-dark transition-colors shadow-sm"
          >
            {loading ? "Importing…" : "Import Now"}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-red-800">Couldn&apos;t process file</p>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-farm-green/10 to-farm-cream/30 border border-farm-green/20 rounded-2xl p-4">
            <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green/80 font-semibold">Preview</p>
            <p className="font-display text-2xl text-farm-dark mt-1">
              {preview.deliveries} deliver{preview.deliveries === 1 ? "y" : "ies"} · {preview.lines} line items
            </p>
            {preview.format === "legacy-delivery-tracker" && (
              <p className="text-xs text-farm-muted mt-1.5 inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Detected legacy <strong>DELIVERY TRACKER</strong> tab
              </p>
            )}
            {preview.skipped > 0 && (
              <p className="text-sm text-amber-700 mt-1">
                {preview.skipped} rows skipped
                {preview.skippedRows && preview.skippedRows.length > 0 && ` — e.g. row ${preview.skippedRows[0].row}: ${preview.skippedRows[0].reason}`}
              </p>
            )}
          </div>

          {preview.sample && preview.sample.length > 0 && (
            <div className="bg-white rounded-2xl border border-farm-dark/5 overflow-hidden shadow-sm">
              <div className="px-4 pt-3 pb-2 border-b border-farm-dark/5 bg-farm-cream/30">
                <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold">Sample deliveries</p>
              </div>
              <div className="divide-y divide-farm-dark/5 max-h-80 overflow-y-auto">
                {preview.sample.map((s, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <p className="text-sm font-medium text-farm-dark">{s.key.replace("::", " — ")}</p>
                    <p className="text-xs text-farm-muted">{s.items.length} items</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 min-h-[48px] bg-white border border-farm-dark/15 text-farm-muted rounded-xl text-sm font-semibold hover:bg-farm-cream/40 transition-colors">
              Cancel
            </button>
            <button
              onClick={runImport}
              disabled={loading}
              className="flex-1 min-h-[48px] bg-farm-green text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-farm-dark transition-colors shadow-sm"
            >
              {loading ? "Importing…" : `Confirm Import`}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-farm-green/15 to-farm-green/5 border border-farm-green/30 rounded-2xl p-5 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-farm-green flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-display text-2xl text-farm-dark">Import complete</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-farm-dark/5 rounded-xl p-3 text-center shadow-sm">
              <p className="font-display text-2xl text-farm-green">{result.importedDeliveries ?? 0}</p>
              <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">Deliveries</p>
            </div>
            <div className="bg-white border border-farm-dark/5 rounded-xl p-3 text-center shadow-sm">
              <p className="font-display text-2xl text-blue-700">{result.importedLines ?? 0}</p>
              <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">Line Items</p>
            </div>
            <div className="bg-white border border-farm-dark/5 rounded-xl p-3 text-center shadow-sm">
              <p className={`font-display text-2xl ${(result.lineErrors ?? 0) > 0 ? "text-red-700" : "text-farm-muted"}`}>{result.lineErrors ?? 0}</p>
              <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">Errors</p>
            </div>
          </div>

          {result.skipped > 0 && (
            <p className="text-xs text-farm-muted text-center">{result.skipped} rows skipped</p>
          )}

          {result.unknownItems && result.unknownItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">
                {result.unknownItems.length} item name{result.unknownItems.length === 1 ? "" : "s"} not in catalog
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                These rows were dropped — add them via items first, then re-import:
              </p>
              <ul className="text-xs text-amber-800 mt-2 space-y-0.5 ml-4 list-disc">
                {result.unknownItems.map((n, i) => (<li key={i}>{n}</li>))}
              </ul>
            </div>
          )}

          {result.unknownRestaurants && result.unknownRestaurants.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
              <p className="text-xs text-amber-800">
                <strong>Note:</strong> {result.unknownRestaurants.length} restaurant name{result.unknownRestaurants.length === 1 ? "" : "s"} not matched
                — fell back to the first restaurant: {result.unknownRestaurants.join(", ")}
              </p>
            </div>
          )}

          <button onClick={reset} className="w-full min-h-[48px] bg-white border border-farm-dark/15 text-farm-dark/85 rounded-xl text-sm font-semibold hover:border-farm-green hover:text-farm-green transition-colors">
            Import Another File
          </button>
        </div>
      )}

      <details className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm overflow-hidden group">
        <summary className="px-4 py-3 cursor-pointer flex items-center justify-between">
          <span className="text-sm font-medium text-farm-dark">Need the column format?</span>
          <svg className="w-4 h-4 text-farm-muted transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-4 text-xs text-farm-muted space-y-2 leading-relaxed">
          <p>For CSV imports, headers (first row):</p>
          <code className="block bg-farm-cream/60 p-2.5 rounded text-[11px] font-pf-mono text-farm-dark overflow-x-auto whitespace-nowrap">
            Date, Restaurant, Item, Quantity, Unit, Unit Price, Line Total, Status, Notes
          </code>
          <ul className="space-y-1 ml-4 list-disc">
            <li><strong>Date</strong>: ISO YYYY-MM-DD, M/D/YY, or any standard date string.</li>
            <li><strong>Restaurant</strong>: matches by full name first, then first-word fuzzy fallback.</li>
            <li><strong>Item</strong>: matches by name (case-insensitive). Items not in catalog are skipped.</li>
            <li><strong>Unit</strong>: ea, sm, lg, gb, bu, qt, pt, lbs, bx, cs, kit (or full names like &ldquo;Bunch&rdquo;).</li>
            <li><strong>Status</strong>: pending, logged, finalized (defaults to <code>finalized</code> for legacy XLSX, <code>logged</code> for CSV).</li>
            <li><strong>Re-imports</strong>: existing delivery for that date+restaurant has its line items wiped and re-inserted from the file.</li>
          </ul>
        </div>
      </details>
      </>)}

      {/* ── Danger zone ───────────────────────────────────────────────
          Lives below the import/export tabs because it operates on the
          full data set, not a single file. Deletes the entire deliveries
          table (line items cascade via FK). Gated by a typed-confirmation
          modal AND a server-side `confirm: "DELETE"` token check.
          ──────────────────────────────────────────────────────────── */}
      {deliveryCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 sm:p-5 space-y-2">
          <p className="text-[10px] tracking-[0.18em] uppercase text-red-700 font-semibold">
            Danger zone
          </p>
          <p className="text-sm text-red-900 leading-relaxed">
            <strong>Delete every delivery and its line items.</strong> This wipes the financial
            source of truth — income, YoY, and executive reports will go to zero. Cannot be undone.
          </p>
          <p className="text-xs text-red-700/80">
            Currently on record: {deliveryCount} deliver{deliveryCount === 1 ? "y" : "ies"} · {lineCount} line item{lineCount === 1 ? "" : "s"}.
          </p>
          <button
            type="button"
            onClick={() => { setConfirmOpen(true); setConfirmText(""); }}
            className="mt-2 inline-flex items-center gap-2 px-4 min-h-[40px] rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 4a2 2 0 012-2h2a2 2 0 012 2v3" />
            </svg>
            Delete all deliveries…
          </button>
        </div>
      )}

      {/* Typed-confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[60] bg-farm-dark/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 sm:p-6">
            <p className="text-[10px] tracking-[0.18em] uppercase text-red-600 font-semibold">
              Permanent · Cannot be undone
            </p>
            <h2 className="font-display text-xl text-farm-dark mt-1">
              Delete all {deliveryCount} deliveries?
            </h2>
            <div className="mt-3 space-y-2 text-sm text-farm-dark/85 leading-relaxed">
              <p>
                Every row in <code className="bg-farm-cream/60 px-1 rounded">deliveries</code> will be
                removed. Their <strong>{lineCount}</strong> line items cascade-delete with them.
              </p>
              <p>
                Reports that read from <code className="bg-farm-cream/60 px-1 rounded">deliveries</code>
                {" "}(income, YoY, executive, monthly digest) will return zero until new deliveries are logged.
              </p>
            </div>
            <label className="block mt-4 text-xs font-medium text-farm-dark">
              Type <span className="font-mono text-red-600">DELETE</span> to enable the button
            </label>
            <input
              type="text"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={deleting}
              placeholder="DELETE"
              className="mt-1.5 w-full px-3 py-2 border border-farm-dark/15 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-50"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setConfirmOpen(false); setConfirmText(""); }}
                disabled={deleting}
                className="px-4 min-h-[40px] rounded-lg border border-farm-dark/15 text-sm font-medium text-farm-muted bg-white hover:bg-farm-cream/40 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runDeleteAll}
                disabled={deleting || confirmText !== "DELETE"}
                className="px-4 min-h-[40px] rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : `Delete ${deliveryCount}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-delete confirmation */}
      {deleteResult && (
        <div className="bg-farm-green/5 border border-farm-green/30 rounded-2xl p-4 sm:p-5">
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green font-semibold">
            Deletion complete
          </p>
          <p className="text-sm text-farm-dark mt-1">
            Removed <strong>{deleteResult.deleted}</strong> deliver{deleteResult.deleted === 1 ? "y" : "ies"}
            {deleteResult.totalValueDeleted > 0 && (
              <> totaling <strong>${deleteResult.totalValueDeleted.toFixed(2)}</strong> in production value</>
            )}.
          </p>
          <p className="text-xs text-farm-muted mt-1.5">
            Refresh the page to see the empty state.
          </p>
        </div>
      )}
    </div>
  );
}
