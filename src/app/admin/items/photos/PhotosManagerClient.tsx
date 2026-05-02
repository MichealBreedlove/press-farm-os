"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Upload, Trash2, X, Search, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "item-photos";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // mirrors server-side cap; we pre-validate so users see fast feedback

interface Photo {
  name: string;
  path: string;        // "items/foo-123.jpg" — what the storage API needs to delete
  url: string;         // public URL — what <img src=> uses
  size: number | null;
  updated_at: string | null;
}

interface UploadResult {
  name: string;
  ok: boolean;
  url?: string;
  error?: string;
}

/**
 * PhotosManagerClient — interactive grid for the photo library.
 *
 * Three flows:
 *   1. Bulk upload — drop or pick many files, parallel upload via
 *      /api/upload/bulk, results banner shows succeeded vs. failed
 *   2. Multi-select — toggle a photo into the selection set, then
 *      "Delete Selected" calls DELETE /api/photos with all paths in
 *      one request
 *   3. Single delete — hover (or long-press on touch) reveals an X
 *      button on each tile that deletes one photo
 *
 * Sort: newest first. Search filters by filename substring.
 */
export function PhotosManagerClient() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Initial load + manual refresh after mutations
  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/photos");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load photos");
      setPhotos(json.photos ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load photos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return photos;
    return photos.filter((p) => p.name.toLowerCase().includes(q));
  }, [photos, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.path));

  function toggleSelect(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of filtered) next.add(p.path);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  // ── Upload flow ──────────────────────────────────────────────────
  //
  // Direct-to-Supabase strategy: ask /api/upload/sign for one signed URL
  // per file (in chunks of 50), then PUT each file straight to Supabase
  // Storage from the browser. The bytes never touch our Vercel API route,
  // so the platform's 4.5MB body cap doesn't apply — bulk uploads of
  // hundreds of catalog photos work without "Request Entity Too Large"
  // 413s. Concurrency cap keeps us under any per-bucket rate limits.
  async function uploadFiles(files: FileList | File[]) {
    const all = Array.from(files);
    if (all.length === 0) return;

    setUploadResults(null);
    setError(null);
    setUploading(true);

    // Pre-filter on the client so we surface obvious problems immediately
    // and don't waste round-trips minting signed URLs for files we'd
    // reject anyway. The server enforces the same rules.
    const validFiles: File[] = [];
    const preErrors: UploadResult[] = [];
    for (const f of all) {
      if (!f.type.startsWith("image/")) {
        preErrors.push({ name: f.name, ok: false, error: "Not an image" });
      } else if (f.size > MAX_FILE_BYTES) {
        preErrors.push({ name: f.name, ok: false, error: "File too large (max 5MB)" });
      } else {
        validFiles.push(f);
      }
    }

    setUploadProgress({ done: 0, total: validFiles.length });
    const supabase = createClient();
    const results: UploadResult[] = [...preErrors];

    // Chunk signed-URL minting — server caps at 50 per request, so we
    // batch in 50s. Within each batch, the actual file PUTs run in
    // parallel with a concurrency cap.
    const SIGN_CHUNK = 50;
    const UPLOAD_CONCURRENCY = 6;

    for (let i = 0; i < validFiles.length; i += SIGN_CHUNK) {
      const chunk = validFiles.slice(i, i + SIGN_CHUNK);

      // Step 1 — get signed URLs for this chunk
      let signed: Array<{ name: string; path: string; token: string; sourceName: string; url: string }> = [];
      let signErrors: Array<{ name: string; error: string }> = [];
      try {
        const res = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: chunk.map((f) => ({ name: f.name, type: f.type, size: f.size })),
          }),
        });
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          // Vercel error pages come back as HTML; surface a clean message
          for (const f of chunk) results.push({ name: f.name, ok: false, error: `Sign failed (HTTP ${res.status})` });
          setUploadProgress((p) => p ? { done: Math.min(p.done + chunk.length, p.total), total: p.total } : null);
          continue;
        }
        const json = await res.json();
        if (!res.ok) {
          for (const f of chunk) results.push({ name: f.name, ok: false, error: json.error ?? "Sign failed" });
          setUploadProgress((p) => p ? { done: Math.min(p.done + chunk.length, p.total), total: p.total } : null);
          continue;
        }
        signed = json.signed ?? [];
        signErrors = json.errors ?? [];
      } catch (err: any) {
        for (const f of chunk) results.push({ name: f.name, ok: false, error: err?.message ?? "Network error" });
        setUploadProgress((p) => p ? { done: Math.min(p.done + chunk.length, p.total), total: p.total } : null);
        continue;
      }

      // Files the server refused at sign time (bad type, too large, etc.)
      for (const e of signErrors) results.push({ name: e.name, ok: false, error: e.error });

      // Step 2 — upload each file directly to Supabase using its signed URL.
      // Pair signed entries back to their File by sourceName so the order
      // doesn't matter if the server reorders them.
      const fileByName = new Map(chunk.map((f) => [f.name, f]));

      // Bounded-concurrency upload pool. simpler than a full-blown queue
      // library — yields the next file when a slot frees up.
      let cursor = 0;
      async function worker() {
        while (cursor < signed.length) {
          const my = cursor++;
          const entry = signed[my];
          const file = fileByName.get(entry.sourceName);
          if (!file) {
            results.push({ name: entry.sourceName, ok: false, error: "File missing locally" });
            setUploadProgress((p) => p ? { done: Math.min(p.done + 1, p.total), total: p.total } : null);
            continue;
          }
          try {
            const { error: upErr } = await supabase.storage
              .from(BUCKET)
              .uploadToSignedUrl(entry.path, entry.token, file, {
                contentType: file.type,
                upsert: false,
              });
            if (upErr) {
              results.push({ name: file.name, ok: false, error: upErr.message });
            } else {
              results.push({ name: file.name, ok: true, url: entry.url });
            }
          } catch (err: any) {
            results.push({ name: file.name, ok: false, error: err?.message ?? "Upload exception" });
          } finally {
            setUploadProgress((p) => p ? { done: Math.min(p.done + 1, p.total), total: p.total } : null);
          }
        }
      }

      const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, signed.length) }, () => worker());
      await Promise.all(workers);
    }

    setUploadResults(results);
    setUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refresh();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) uploadFiles(e.target.files);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }

  // ── Delete flows ─────────────────────────────────────────────────
  async function deletePaths(paths: string[]) {
    if (paths.length === 0) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      // Optimistic local removal so the UI doesn't flash an empty grid
      // while refresh() hits the network
      setPhotos((prev) => prev.filter((p) => !paths.includes(p.path)));
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of paths) next.delete(p);
        return next;
      });
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} photo${selected.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
    await deletePaths(Array.from(selected));
  }

  async function deleteOne(path: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deletePaths([path]);
  }

  // ── Render ────────────────────────────────────────────────────────
  const succeeded = uploadResults?.filter((r) => r.ok).length ?? 0;
  const failed = (uploadResults?.length ?? 0) - succeeded;

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed transition-colors px-4 py-6 text-center ${
          dragOver
            ? "border-farm-green bg-farm-green/5"
            : "border-farm-dark/15 bg-white"
        }`}
      >
        <Upload className="w-7 h-7 text-farm-muted mx-auto mb-2" />
        <p className="text-sm text-farm-dark font-medium">
          Drop photos here, or
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-farm-green text-white text-sm font-semibold hover:bg-farm-dark disabled:opacity-50 transition-colors min-h-[40px]"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading
            ? uploadProgress
              ? `Uploading ${uploadProgress.done} / ${uploadProgress.total}…`
              : "Uploading…"
            : "Choose Photos"}
        </button>
        <p className="text-xs text-farm-muted mt-2">
          JPG / PNG / WebP · up to 5 MB each · drop hundreds at once
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onPick}
          className="hidden"
        />
      </div>

      {/* Upload result banner */}
      {uploadResults && (
        <div className={`rounded-xl border px-4 py-3 ${
          failed === 0
            ? "border-farm-green/30 bg-farm-green/5"
            : "border-pf-master-orange/30 bg-pf-master-orange/[0.06]"
        }`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-farm-dark">
              {succeeded > 0 && `${succeeded} uploaded`}
              {succeeded > 0 && failed > 0 && " · "}
              {failed > 0 && <span className="text-pf-master-orange">{failed} failed</span>}
            </p>
            <button
              type="button"
              onClick={() => setUploadResults(null)}
              className="text-farm-muted hover:text-farm-dark min-h-0"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {failed > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-farm-muted">
              {uploadResults!.filter((r) => !r.ok).slice(0, 5).map((r, i) => (
                <li key={i} className="truncate">
                  <span className="text-pf-master-orange font-medium">{r.name}</span>
                  {" — "}
                  {r.error}
                </li>
              ))}
              {uploadResults!.filter((r) => !r.ok).length > 5 && (
                <li>+ {uploadResults!.filter((r) => !r.ok).length - 5} more failures</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Search + selection toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-farm-muted" />
          <input
            type="search"
            placeholder="Search by filename…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 min-h-[44px] border border-farm-dark/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
          />
        </div>
      </div>

      {/* Selection bar — shown when something is selected */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-farm-cream/95 backdrop-blur-sm border-y border-farm-dark/5 flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-farm-dark">
            {selected.size} selected
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={allFilteredSelected ? clearSelection : selectAllFiltered}
              className="text-xs font-medium text-farm-green hover:underline min-h-0"
            >
              {allFilteredSelected ? "Clear" : "Select all visible"}
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 min-h-[36px]"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete {selected.size}
            </button>
          </div>
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-farm-muted">
        {loading
          ? "Loading…"
          : `${filtered.length} of ${photos.length} ${photos.length === 1 ? "photo" : "photos"}${search ? ` matching “${search}”` : ""}`}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="py-16 text-center text-farm-muted text-sm">Loading photos…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-farm-muted text-sm">
          {photos.length === 0
            ? "No photos uploaded yet. Drop some above to get started."
            : `No photos match “${search}”.`}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {filtered.map((photo) => {
            const isSelected = selected.has(photo.path);
            return (
              <div
                key={photo.path}
                className={`relative aspect-square rounded-lg overflow-hidden group border-2 transition-all ${
                  isSelected
                    ? "border-farm-green ring-2 ring-farm-green/30"
                    : "border-transparent hover:border-farm-dark/15"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSelect(photo.path)}
                  className="absolute inset-0 w-full h-full"
                  title={photo.name}
                >
                  <img
                    src={photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>

                {/* Selection checkbox indicator (top-left) */}
                <div
                  className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center pointer-events-none transition-all ${
                    isSelected
                      ? "bg-farm-green border-farm-green"
                      : "bg-white/80 border-white/80 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                </div>

                {/* Single-photo delete (top-right, hover/touch reveal) */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteOne(photo.path, photo.name); }}
                  disabled={deleting}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow disabled:opacity-30"
                  aria-label={`Delete ${photo.name}`}
                  title="Delete this photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
