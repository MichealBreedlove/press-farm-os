"use client";

import { useState, useRef } from "react";

type ImportTarget = "key-tab" | "delivery-history";

interface PreviewResult {
  total?: number;
  deliveries?: number;
  lines?: number;
  skipped: number;
  preview?: { name: string; category: string; unit: string; price: number }[];
  sample?: { key: string; items: { item: string; qty: number; unit: string; price: number }[] }[];
}

interface ImportResult {
  imported?: number;
  importedDeliveries?: number;
  importedLines?: number;
  errors?: number;
  lineErrors?: number;
  skipped: number;
}

export default function AdminImportPage() {
  const [target, setTarget] = useState<ImportTarget>("key-tab");
  const [file, setFile] = useState<File | null>(null);
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

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/import/${target}?preview=true`, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Preview failed");
      setPreview(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/import/${target}?preview=false`, { method: "POST", body: form });
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
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Data Import</h1>
        <p className="text-sm text-gray-500">One-time migration from Excel</p>
      </header>

      <div className="px-4 py-6 space-y-5">
        {/* Source file info */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">Source File</p>
          <p className="text-xs text-amber-700 break-all">
            Daily Delivery Tracking Sheet (DO NOT MODIFY).xlsx
          </p>
          <p className="text-xs text-amber-600 mt-1">
            Downloads › OneDrive_1_3-19-2026 › All Recipes + Kitchen Documents › 1.9 - Farm &amp; Preservation
          </p>
        </div>

        {/* Import target selector */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Import Type</p>
          <div className="grid grid-cols-2 gap-2">
            {(["key-tab", "delivery-history"] as ImportTarget[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTarget(t); reset(); }}
                className={`min-h-[48px] rounded-xl border text-sm font-medium transition-colors ${
                  target === t
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                }`}
              >
                {t === "key-tab" ? "Price Catalog\n(KEY tab)" : "Delivery History\n(DELIVERY TRACKER)"}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {target === "key-tab"
              ? "Imports 289 items with prices into Items catalog and Price Catalog."
              : "Imports historical deliveries into Deliveries and Delivery Items. Items must be imported first."}
          </p>
        </div>

        {/* File picker */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Upload File (.xlsx)</p>
          <label className="block w-full min-h-[56px] border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="sr-only"
              onChange={(e) => { reset(); setFile(e.target.files?.[0] ?? null); }}
            />
            <span className="text-sm text-gray-400">
              {file ? file.name : "Tap to choose file"}
            </span>
          </label>
        </div>

        {/* Actions */}
        {file && !result && (
          <div className="flex gap-3">
            <button
              onClick={handlePreview}
              disabled={loading}
              className="flex-1 min-h-[44px] bg-gray-100 text-gray-700 rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-gray-200 transition-colors"
            >
              {loading && !preview ? "Parsing…" : "Preview"}
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="btn-primary flex-1 min-h-[44px] text-sm font-medium disabled:opacity-50"
            >
              {loading && preview ? "Importing…" : "Import"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Preview results */}
        {preview && (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-medium text-blue-900 mb-1">Preview</p>
              {target === "key-tab" ? (
                <p className="text-sm text-blue-700">
                  Found <strong>{preview.total}</strong> items to import
                  {preview.skipped > 0 && `, ${preview.skipped} skipped (missing name or price)`}.
                </p>
              ) : (
                <p className="text-sm text-blue-700">
                  Found <strong>{preview.deliveries}</strong> deliveries,{" "}
                  <strong>{preview.lines}</strong> line items
                  {preview.skipped > 0 && `, ${preview.skipped} skipped`}.
                </p>
              )}
            </div>

            {/* Key tab preview rows */}
            {preview.preview && preview.preview.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <p className="px-4 pt-3 pb-2 text-xs font-medium text-gray-500">
                  First {preview.preview.length} items
                </p>
                <div className="divide-y divide-gray-50">
                  {preview.preview.map((row, i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium text-gray-900 truncate block">{row.name}</span>
                        <span className="text-xs text-gray-400">{row.category} · {row.unit}</span>
                      </div>
                      <span className="text-gray-700 font-medium flex-shrink-0">${row.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delivery history preview */}
            {preview.sample && preview.sample.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <p className="px-4 pt-3 pb-2 text-xs font-medium text-gray-500">
                  Sample deliveries
                </p>
                <div className="divide-y divide-gray-50">
                  {preview.sample.map((s, i) => (
                    <div key={i} className="px-4 py-2 text-sm">
                      <p className="font-medium text-gray-800">{s.key.replace("::", " — ")}</p>
                      <p className="text-xs text-gray-400">{s.items.length} items</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={loading}
              className="btn-primary w-full min-h-[44px] text-sm font-medium disabled:opacity-50"
            >
              {loading ? "Importing…" : "Confirm Import"}
            </button>
          </div>
        )}

        {/* Success result */}
        {result && (
          <div className="bg-farm-green-light border border-farm-green/20 rounded-xl p-4 space-y-2">
            <p className="text-sm font-semibold text-farm-green">Import Complete</p>
            {target === "key-tab" ? (
              <>
                <p className="text-sm text-farm-green">
                  <strong>{result.imported}</strong> items imported
                </p>
                {(result.errors ?? 0) > 0 && (
                  <p className="text-sm text-orange-600">{result.errors} errors</p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-farm-green">
                  <strong>{result.importedDeliveries}</strong> deliveries,{" "}
                  <strong>{result.importedLines}</strong> line items imported
                </p>
                {(result.lineErrors ?? 0) > 0 && (
                  <p className="text-sm text-orange-600">{result.lineErrors} line errors (items not found in catalog)</p>
                )}
              </>
            )}
            {result.skipped > 0 && (
              <p className="text-xs text-gray-500">{result.skipped} rows skipped (missing data)</p>
            )}
            <button
              onClick={reset}
              className="btn-secondary w-full min-h-[44px] text-sm font-medium mt-2"
            >
              Import Another File
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
