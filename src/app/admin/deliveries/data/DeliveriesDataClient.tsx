"use client";

import { useState, useRef, useCallback } from "react";

interface PreviewResult {
  deliveries?: number;
  lines?: number;
  skipped: number;
  sample?: { key: string; items: { item: string; qty: number; unit: string; price: number }[] }[];
}

interface ImportResult {
  importedDeliveries?: number;
  importedLines?: number;
  lineErrors?: number;
  skipped: number;
}

interface Props {
  deliveryCount: number;
  lineCount: number;
}

export function DeliveriesDataClient({ deliveryCount, lineCount }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const res = await fetch("/api/import/delivery-history?preview=true", { method: "POST", body: form });
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
      const res = await fetch("/api/import/delivery-history?preview=false", { method: "POST", body: form });
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

      {/* Helper banner */}
      <div className="bg-gradient-to-br from-blue-50 to-farm-cream/30 border border-blue-100 rounded-2xl p-4">
        <p className="text-[10px] tracking-[0.18em] uppercase text-blue-700/80 font-semibold">DELIVERY TRACKER tab</p>
        <p className="text-sm text-farm-dark mt-1.5 leading-relaxed">
          Drop your <em>Daily Delivery Tracking Sheet</em>. We&apos;ll read the
          <strong> DELIVERY TRACKER</strong> tab, group rows by date + restaurant,
          and create finalized deliveries with all line items matched to your catalog.
        </p>
        <p className="text-xs text-farm-muted/80 mt-2 leading-relaxed">
          Items in the tracker that don&apos;t exist in your catalog yet will be skipped — import items first via the items page.
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
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(e) => { reset(); setFile(e.target.files?.[0] ?? null); }}
          />
          <div className="w-14 h-14 mx-auto rounded-2xl bg-farm-green/10 flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-farm-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 8v9a3 3 0 01-3 3H7a3 3 0 01-3-3V8m12 4l-4-4m0 0l-4 4m4-4v12" />
            </svg>
          </div>
          <p className="font-display text-lg text-farm-dark">Drop your XLSX here</p>
          <p className="text-sm text-farm-muted mt-1">or tap to browse</p>
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
            {preview.skipped > 0 && (
              <p className="text-sm text-orange-600 mt-1">{preview.skipped} rows skipped (missing data or unknown items)</p>
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
              <p className="font-display text-2xl text-blue-600">{result.importedLines ?? 0}</p>
              <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">Line Items</p>
            </div>
            <div className="bg-white border border-farm-dark/5 rounded-xl p-3 text-center shadow-sm">
              <p className={`font-display text-2xl ${(result.lineErrors ?? 0) > 0 ? "text-red-600" : "text-farm-muted"}`}>{result.lineErrors ?? 0}</p>
              <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">Errors</p>
            </div>
          </div>

          {result.skipped > 0 && (
            <p className="text-xs text-farm-muted text-center">{result.skipped} rows skipped</p>
          )}

          <button onClick={reset} className="w-full min-h-[48px] bg-white border border-farm-dark/15 text-farm-dark/85 rounded-xl text-sm font-semibold hover:border-farm-green hover:text-farm-green transition-colors">
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
