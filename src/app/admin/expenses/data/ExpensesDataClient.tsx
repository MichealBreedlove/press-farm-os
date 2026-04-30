"use client";

import { useState, useRef, useCallback } from "react";

type Tab = "export" | "import";

interface PreviewRow {
  date: string;
  vendor: string | null;
  category: string;
  description: string | null;
  amount: number;
  isUpdate: boolean;
}

interface PreviewResult {
  total: number;
  newCount: number;
  updateCount: number;
  skipped: number;
  preview: PreviewRow[];
  skippedRows: { row: number; reason: string }[];
}

interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: { row: string; error: string }[];
}

interface Props {
  totalCount: number;
  totalAmount: number;
  latestDate: string | null;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function ExpensesDataClient({ totalCount, totalAmount, latestDate }: Props) {
  const [tab, setTab] = useState<Tab>("export");

  // ─── Export state ───
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // ─── Import state ───
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetImport() {
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
      resetImport();
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
      const res = await fetch("/api/import/expenses-csv?preview=true", { method: "POST", body: form });
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
      const res = await fetch("/api/import/expenses-csv?preview=false", { method: "POST", body: form });
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

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/expenses/export${params.toString() ? `?${params}` : ""}`;
  })();

  return (
    <div className="space-y-6">
      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-farm-dark/5 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">Total</p>
          <p className="font-display text-3xl text-farm-dark mt-1">{totalCount}</p>
          <p className="text-xs text-farm-muted mt-0.5">expenses logged</p>
        </div>
        <div className="bg-white border border-farm-dark/5 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">Spend</p>
          <p className="font-display text-3xl text-farm-dark mt-1">{formatCurrency(totalAmount).replace("$", "$")}</p>
          <p className="text-xs text-farm-muted mt-0.5">all-time</p>
        </div>
        <div className="bg-white border border-farm-dark/5 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">Latest</p>
          <p className="font-display text-xl text-farm-dark mt-1.5">
            {latestDate ? new Date(latestDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
          </p>
          <p className="text-xs text-farm-muted mt-0.5">most recent</p>
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

      {/* EXPORT */}
      {tab === "export" && (
        <div className="bg-white rounded-2xl border border-farm-dark/5 overflow-hidden shadow-sm">
          <div className="px-5 pt-5 pb-3 bg-gradient-to-br from-farm-green/8 to-farm-cream/40 border-b border-farm-dark/5">
            <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green/80 font-semibold">CSV Snapshot</p>
            <p className="font-display text-xl text-farm-dark mt-1">Download expense ledger</p>
            <p className="text-sm text-farm-muted mt-1.5 leading-relaxed">
              7 columns including the <strong>ID</strong> so re-imports can update existing rows in place.
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Date range filter */}
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
              <button
                type="button"
                onClick={() => { setFrom(""); setTo(""); }}
                className="text-xs text-farm-muted hover:text-farm-green"
              >
                Clear date range
              </button>
            )}

            <div className="rounded-xl border border-farm-dark/5 overflow-hidden">
              <div className="bg-farm-cream/40 px-3 py-2 border-b border-farm-dark/5">
                <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold">Columns</p>
              </div>
              <div className="px-3 py-2.5 flex flex-wrap gap-1">
                {["ID", "Date", "Vendor", "Category", "Description", "Amount", "Receipt URL"].map((col) => (
                  <span key={col} className="text-[10px] bg-farm-cream/60 text-farm-dark/80 px-2 py-0.5 rounded">{col}</span>
                ))}
              </div>
            </div>

            <a
              href={exportHref}
              className="w-full min-h-[52px] bg-farm-green text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-farm-dark transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download {from || to ? "filtered" : "all"} expenses
            </a>

            <p className="text-[11px] text-farm-muted text-center">
              File: <code className="font-pf-mono bg-farm-cream/60 px-1.5 py-0.5 rounded">press-farm-expenses-{new Date().toISOString().slice(0, 10)}.csv</code>
            </p>
          </div>
        </div>
      )}

      {/* IMPORT */}
      {tab === "import" && (
        <div className="space-y-4">
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
                onChange={(e) => { resetImport(); setFile(e.target.files?.[0] ?? null); }}
              />
              <div className="w-14 h-14 mx-auto rounded-2xl bg-farm-green/10 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-farm-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v9a3 3 0 01-3 3H7a3 3 0 01-3-3V8m12 4l-4-4m0 0l-4 4m4-4v12" />
                </svg>
              </div>
              <p className="font-display text-lg text-farm-dark">Drop your file here</p>
              <p className="text-sm text-farm-muted mt-1">.csv or .xlsx</p>
              <p className="text-[11px] text-farm-muted/70 mt-3 max-w-sm mx-auto">
                Rows with a UUID in the <strong>ID</strong> column update existing expenses; rows without an ID create new ones.
              </p>
            </div>
          )}

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
              <button type="button" onClick={resetImport} className="min-w-[36px] min-h-[36px] flex items-center justify-center text-farm-muted hover:text-farm-dark" aria-label="Remove file">
                ✕
              </button>
            </div>
          )}

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

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
              <p className="text-sm font-semibold text-red-800">Couldn&apos;t process file</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-farm-green/10 to-farm-cream/30 border border-farm-green/20 rounded-2xl p-4">
                <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green/80 font-semibold">Preview</p>
                <p className="font-display text-2xl text-farm-dark mt-1">
                  {preview.total} row{preview.total === 1 ? "" : "s"} ready
                </p>
                <p className="text-sm text-farm-muted mt-1">
                  {preview.newCount} new · {preview.updateCount} update{preview.updateCount === 1 ? "" : "s"}
                  {preview.skipped > 0 && ` · ${preview.skipped} skipped`}
                </p>
                {preview.skipped > 0 && preview.skippedRows.length > 0 && (
                  <p className="text-xs text-amber-700 mt-1">
                    e.g. row {preview.skippedRows[0].row}: {preview.skippedRows[0].reason}
                  </p>
                )}
              </div>

              {preview.preview.length > 0 && (
                <div className="bg-white rounded-2xl border border-farm-dark/5 overflow-hidden shadow-sm">
                  <div className="px-4 pt-3 pb-2 border-b border-farm-dark/5 bg-farm-cream/30">
                    <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold">First {preview.preview.length} rows</p>
                  </div>
                  <div className="divide-y divide-farm-dark/5 max-h-80 overflow-y-auto">
                    {preview.preview.map((row, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-farm-dark truncate">
                              {row.vendor ?? "(no vendor)"}
                            </span>
                            {row.isUpdate && (
                              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                                update
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-farm-muted">
                            {row.date} · {row.category}{row.description ? ` · ${row.description}` : ""}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-farm-dark flex-shrink-0">
                          {formatCurrency(row.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={resetImport} className="flex-1 min-h-[48px] bg-white border border-farm-dark/15 text-farm-muted rounded-xl text-sm font-semibold hover:bg-farm-cream/40 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={runImport}
                  disabled={loading}
                  className="flex-1 min-h-[48px] bg-farm-green text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-farm-dark transition-colors shadow-sm"
                >
                  {loading ? "Importing…" : `Confirm`}
                </button>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-farm-green/15 to-farm-green/5 border border-farm-green/30 rounded-2xl p-5 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-farm-green flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-display text-2xl text-farm-dark">Import complete</p>
                <p className="text-sm text-farm-muted mt-1">{result.total} row{result.total === 1 ? "" : "s"} processed</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white border border-farm-dark/5 rounded-xl p-3 text-center shadow-sm">
                  <p className="font-display text-2xl text-farm-green">{result.imported}</p>
                  <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">New</p>
                </div>
                <div className="bg-white border border-farm-dark/5 rounded-xl p-3 text-center shadow-sm">
                  <p className="font-display text-2xl text-blue-700">{result.updated}</p>
                  <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">Updated</p>
                </div>
                <div className="bg-white border border-farm-dark/5 rounded-xl p-3 text-center shadow-sm">
                  <p className={`font-display text-2xl ${result.errors > 0 ? "text-red-700" : "text-farm-muted"}`}>{result.errors}</p>
                  <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">Errors</p>
                </div>
              </div>

              {result.errorDetails.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">Error details</p>
                  <ul className="text-xs text-red-700 space-y-1">
                    {result.errorDetails.map((e, i) => (
                      <li key={i}><strong>{e.row}</strong>: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button onClick={resetImport} className="w-full min-h-[48px] bg-white border border-farm-dark/15 text-farm-dark/85 rounded-xl text-sm font-semibold hover:border-farm-green hover:text-farm-green transition-colors">
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
              <p>Headers (first row of CSV):</p>
              <code className="block bg-farm-cream/60 p-2.5 rounded text-[11px] font-pf-mono text-farm-dark overflow-x-auto whitespace-nowrap">
                ID, Date, Vendor, Category, Description, Amount, Receipt URL
              </code>
              <ul className="space-y-1 ml-4 list-disc">
                <li><strong>ID</strong> (optional): UUID of an existing expense → row will be updated. Leave blank to insert a new row.</li>
                <li><strong>Date</strong>: YYYY-MM-DD, M/D/YY, or any standard date string.</li>
                <li><strong>Category</strong>: Seeds, Soil, Amendments, Equipment, Gas, Transport, Supplies, Labor, Software, Other (defaults to Other if blank/unknown).</li>
                <li><strong>Amount</strong>: numeric. Currency symbols stripped automatically.</li>
              </ul>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
