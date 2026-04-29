"use client";

import { useState, useRef, useCallback } from "react";

type Tab = "export" | "import";

interface PreviewRow {
  name: string;
  category: string;
  unit_type: string;
  prices: Record<string, number>;
  default_price: number | null;
  size: string | null;
}

interface PreviewResult {
  total: number;
  skipped: number;
  preview: PreviewRow[];
  skippedRows: { row: number; name: string; reason: string }[];
}

interface ImportResult {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: { name: string; error: string }[];
}

interface Props {
  activeCount: number;
  archivedCount: number;
}

export function DataClient({ activeCount, archivedCount }: Props) {
  const [tab, setTab] = useState<Tab>("export");

  // ─── Export state ───
  const [includeArchived, setIncludeArchived] = useState(false);

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
      const res = await fetch("/api/import/items-csv?preview=true", { method: "POST", body: form });
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
      const res = await fetch("/api/import/items-csv?preview=false", { method: "POST", body: form });
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

  const totalCount = activeCount + (includeArchived ? archivedCount : 0);
  const exportHref = `/api/items/export?archived=${includeArchived}`;

  return (
    <div className="space-y-6">
      {/* ─── Stat strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-farm-dark/5 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">Active</p>
          <p className="font-display text-3xl text-farm-dark mt-1">{activeCount}</p>
          <p className="text-xs text-farm-muted mt-0.5">items in catalog</p>
        </div>
        <div className="bg-white border border-farm-dark/5 rounded-2xl p-4 shadow-sm">
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">Archived</p>
          <p className="font-display text-3xl text-farm-dark mt-1">{archivedCount}</p>
          <p className="text-xs text-farm-muted mt-0.5">soft-deleted</p>
        </div>
      </div>

      {/* ─── Tab strip ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-farm-dark/5 p-1 shadow-sm flex gap-1">
        <button
          type="button"
          onClick={() => setTab("export")}
          className={`flex-1 min-h-[44px] rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
            tab === "export"
              ? "bg-farm-green text-white shadow-sm"
              : "text-farm-muted hover:bg-farm-cream/40"
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
            tab === "import"
              ? "bg-farm-green text-white shadow-sm"
              : "text-farm-muted hover:bg-farm-cream/40"
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v9a3 3 0 01-3 3H7a3 3 0 01-3-3V8m12 4l-4-4m0 0l-4 4m4-4v12" />
          </svg>
          Import
        </button>
      </div>

      {/* ─── EXPORT TAB ────────────────────────────────────────── */}
      {tab === "export" && (
        <div className="bg-white rounded-2xl border border-farm-dark/5 overflow-hidden shadow-sm">
          <div className="px-5 pt-5 pb-3 bg-gradient-to-br from-farm-green/8 to-farm-cream/40 border-b border-farm-dark/5">
            <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green/80 font-semibold">CSV Snapshot</p>
            <p className="font-display text-xl text-farm-dark mt-1">Download every item</p>
            <p className="text-sm text-farm-muted mt-1.5 leading-relaxed">
              13 columns matching the import format — open in Excel, edit, and re-import without losing data.
            </p>
          </div>

          <div className="p-5 space-y-4">
            {/* Toggle */}
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-farm-cream/40 cursor-pointer hover:bg-farm-cream/60 transition-colors">
              <div>
                <p className="text-sm font-medium text-farm-dark">Include archived items</p>
                <p className="text-xs text-farm-muted mt-0.5">
                  {includeArchived
                    ? `Including ${archivedCount} archived`
                    : `Skipping ${archivedCount} archived`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIncludeArchived((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${includeArchived ? "bg-farm-green" : "bg-gray-300"}`}
                aria-pressed={includeArchived}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${includeArchived ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </label>

            {/* Column preview */}
            <div className="rounded-xl border border-farm-dark/5 overflow-hidden">
              <div className="bg-farm-cream/40 px-3 py-2 border-b border-farm-dark/5">
                <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold">Columns</p>
              </div>
              <div className="px-3 py-2.5 flex flex-wrap gap-1">
                {[
                  "Name", "Category", "Variety", "Color", "Sizes", "Containers",
                  "Prices", "Default Price", "Chef Notes", "Internal Notes",
                  "Source", "Season Status", "Archived",
                ].map((col) => (
                  <span key={col} className="text-[10px] bg-farm-cream/60 text-farm-dark/80 px-2 py-0.5 rounded">
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Big download CTA */}
            <a
              href={exportHref}
              className="w-full min-h-[52px] bg-farm-green text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-farm-dark transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download {totalCount} items as CSV
            </a>

            <p className="text-[11px] text-farm-muted text-center">
              File: <code className="font-pf-mono bg-farm-cream/60 px-1.5 py-0.5 rounded">press-farm-items-{new Date().toISOString().slice(0, 10)}.csv</code>
            </p>
          </div>
        </div>
      )}

      {/* ─── IMPORT TAB ────────────────────────────────────────── */}
      {tab === "import" && (
        <div className="space-y-4">
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
                onChange={(e) => { resetImport(); setFile(e.target.files?.[0] ?? null); }}
              />
              <div className="w-14 h-14 mx-auto rounded-2xl bg-farm-green/10 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-farm-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v9a3 3 0 01-3 3H7a3 3 0 01-3-3V8m12 4l-4-4m0 0l-4 4m4-4v12" />
                </svg>
              </div>
              <p className="font-display text-lg text-farm-dark">Drop your CSV here</p>
              <p className="text-sm text-farm-muted mt-1">or tap to browse — accepts .csv or .xlsx</p>
              <p className="text-[11px] text-farm-muted/70 mt-3 max-w-sm mx-auto">
                Use the export above as a template. Headers must match: Name, Category, Containers, Prices, …
              </p>
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
              <button
                type="button"
                onClick={resetImport}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center text-farm-muted hover:text-farm-dark"
                aria-label="Remove file"
              >
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

          {/* Preview results */}
          {preview && (
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-farm-green/10 to-farm-cream/30 border border-farm-green/20 rounded-2xl p-4">
                <p className="text-[10px] tracking-[0.18em] uppercase text-farm-green/80 font-semibold">Preview</p>
                <p className="font-display text-2xl text-farm-dark mt-1">
                  {preview.total} item{preview.total === 1 ? "" : "s"} ready
                </p>
                {preview.skipped > 0 && (
                  <p className="text-sm text-orange-600 mt-1">
                    {preview.skipped} skipped — {preview.skippedRows.length > 0 ? `e.g. row ${preview.skippedRows[0].row}: ${preview.skippedRows[0].reason}` : "missing required fields"}
                  </p>
                )}
              </div>

              {/* Sample rows */}
              {preview.preview.length > 0 && (
                <div className="bg-white rounded-2xl border border-farm-dark/5 overflow-hidden shadow-sm">
                  <div className="px-4 pt-3 pb-2 border-b border-farm-dark/5 bg-farm-cream/30">
                    <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted font-semibold">
                      First {preview.preview.length} rows
                    </p>
                  </div>
                  <div className="divide-y divide-farm-dark/5 max-h-80 overflow-y-auto">
                    {preview.preview.map((row, i) => {
                      const priceList = Object.entries(row.prices);
                      return (
                        <div key={i} className="px-4 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-farm-dark truncate">{row.name}</span>
                            <span className="text-[10px] bg-farm-cream/60 text-farm-muted px-2 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                              {row.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-farm-muted">{row.unit_type.toUpperCase()}</span>
                            {priceList.length > 0 && (
                              <span className="text-xs text-farm-green">
                                · {priceList.map(([u, p]) => `${u.toUpperCase()} $${p.toFixed(2)}`).join(" · ")}
                              </span>
                            )}
                            {priceList.length === 0 && row.default_price != null && (
                              <span className="text-xs text-farm-green">· ${row.default_price.toFixed(2)}</span>
                            )}
                            {row.size && <span className="text-xs text-farm-muted">· {row.size}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={resetImport}
                  className="flex-1 min-h-[48px] bg-white border border-farm-dark/15 text-farm-muted rounded-xl text-sm font-semibold hover:bg-farm-cream/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={runImport}
                  disabled={loading}
                  className="flex-1 min-h-[48px] bg-farm-green text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-farm-dark transition-colors shadow-sm"
                >
                  {loading ? "Importing…" : `Confirm Import of ${preview.total}`}
                </button>
              </div>
            </div>
          )}

          {/* Success result */}
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
                  <p className="font-display text-2xl text-blue-600">{result.updated}</p>
                  <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">Updated</p>
                </div>
                <div className="bg-white border border-farm-dark/5 rounded-xl p-3 text-center shadow-sm">
                  <p className={`font-display text-2xl ${result.errors > 0 ? "text-red-600" : "text-farm-muted"}`}>{result.errors}</p>
                  <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">Errors</p>
                </div>
              </div>

              {result.errorDetails.length > 0 && (
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-red-800 mb-2">Error details</p>
                  <ul className="text-xs text-red-700 space-y-1">
                    {result.errorDetails.map((e, i) => (
                      <li key={i}><strong>{e.name}</strong>: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={resetImport}
                className="w-full min-h-[48px] bg-white border border-farm-dark/15 text-farm-dark/85 rounded-xl text-sm font-semibold hover:border-farm-green hover:text-farm-green transition-colors"
              >
                Import Another File
              </button>
            </div>
          )}

          {/* Schema reference (collapsible) */}
          <details className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm overflow-hidden group">
            <summary className="px-4 py-3 cursor-pointer flex items-center justify-between">
              <span className="text-sm font-medium text-farm-dark">Need the column format?</span>
              <svg className="w-4 h-4 text-farm-muted transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 text-xs text-farm-muted space-y-2 leading-relaxed">
              <p>Headers (case-sensitive, comma-separated CSV):</p>
              <code className="block bg-farm-cream/60 p-2.5 rounded text-[11px] font-pf-mono text-farm-dark overflow-x-auto whitespace-nowrap">
                Name, Category, Variety, Color, Sizes, Containers, Prices, Default Price, Chef Notes, Internal Notes, Source, Season Status, Archived
              </code>
              <ul className="space-y-1 ml-4 list-disc">
                <li><strong>Category:</strong> flowers, micros_leaves, herbs_leaves, fruit_veg, kits, family_meal</li>
                <li><strong>Containers:</strong> ea, sm, lg, gb, bu, qt, pt, lbs, bx, cs, kit (comma-separated)</li>
                <li><strong>Prices:</strong> e.g. <code className="bg-farm-cream/60 px-1 rounded">sm:15.00, lg:30.00</code></li>
                <li><strong>Match by Name:</strong> existing items get updated, new ones inserted</li>
                <li><strong>Season Status:</strong> available, ending_soon, coming_soon, out_of_season</li>
              </ul>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
