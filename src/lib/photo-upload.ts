"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Shared browser-side photo upload helpers.
 *
 * Every photo upload in the app goes direct-to-Supabase: ask
 * /api/upload/sign for a signed upload URL, then PUT the bytes straight
 * from the browser to Supabase Storage. The file never passes through a
 * Vercel API route, so the platform's 4.5MB request-body cap doesn't
 * apply — an iPhone photo (typically 3–12MB) uploads fine.
 *
 * Used by the bulk photo manager (/admin/items/photos) and the single
 * PhotoPicker on the item detail page. The picker used to POST the file
 * body to /api/upload, which Vercel rejected with an HTML 413 for any
 * phone photo over ~4.5MB; the picker swallowed the error, so the
 * upload just silently did nothing.
 */

export const PHOTO_BUCKET = "item-photos";
export const MAX_FILE_BYTES = 15 * 1024 * 1024; // server cap — pre-validate to fail fast on truly oversized files
export const RESIZE_THRESHOLD_BYTES = 5 * 1024 * 1024; // anything larger gets auto-resized client-side
export const RESIZE_MAX_DIM = 2400; // longest-edge cap; product photos don't need more
export const RESIZE_QUALITY = 0.85; // JPEG quality after resize — visually lossless for catalog use
export const MAX_UPLOAD_ATTEMPTS = 3; // total tries per file when Supabase returns a transient error

export interface SignedUploadEntry {
  name: string;
  path: string;
  token: string;
  sourceName: string;
  url: string;
}

/**
 * Match transient infra errors that should be retried instead of surfaced.
 * Supabase's edge throws these intermittently when a bucket is bombarded
 * with parallel writes; the file isn't actually rejected, the request just
 * needs to be redone after a short backoff.
 */
export function isTransientUploadError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  return /bad gateway|gateway timeout|http 50[234]|fetch failed|network|timeout|econn|enotfound/i.test(msg);
}

/**
 * Downscale + re-encode a photo if it's bulky. Files under the threshold
 * are returned as-is so we don't quietly re-encode the user's originals.
 *
 * Why client-side? Phone cameras emit 8-25MB photos, but our catalog
 * thumbnails never need more than ~2400px on the long edge. Resizing
 * before upload (a) lets us accept any input size without raising the
 * server cap further, (b) saves bandwidth + storage, (c) gives the user
 * fast feedback if their browser can't decode the image (HEIC, etc.).
 *
 * Falls back to the original file on any failure — better to attempt the
 * upload (and let the server reject with a clear "too large" message)
 * than to silently drop the file.
 */
export async function maybeResize(file: File): Promise<File> {
  if (file.size <= RESIZE_THRESHOLD_BYTES) return file;
  if (typeof createImageBitmap !== "function") return file; // very old browsers

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > RESIZE_MAX_DIM ? RESIZE_MAX_DIM / longest : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", RESIZE_QUALITY),
    );
    if (!blob) return file;
    // If "compression" actually made the file bigger (rare with JPEG-in,
    // possible with already-tiny PNGs), keep the original.
    if (blob.size >= file.size) return file;

    // Force .jpg extension since we re-encoded as JPEG. Filename stays
    // recognizable for the user's "I uploaded foo.png" mental model.
    const newName = file.name.replace(/\.[^.]+$/, ".jpg");
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/**
 * Ask the server for signed upload URLs for a batch of files (max 50).
 * Returns the signed entries plus any per-file refusals. Throws on a
 * batch-level failure (auth, network, non-JSON response) with a message
 * safe to show the user.
 */
export async function signPhotoUploads(
  files: File[],
): Promise<{ signed: SignedUploadEntry[]; errors: Array<{ name: string; error: string }> }> {
  const res = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: files.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    }),
  });
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    // Vercel error pages come back as HTML; surface a clean message
    throw new Error(`Sign failed (HTTP ${res.status})`);
  }
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Sign failed");
  return { signed: json.signed ?? [], errors: json.errors ?? [] };
}

/**
 * PUT one file to Supabase Storage via its signed URL, retrying transient
 * edge errors with backoff. Resolves on success; throws with the last
 * error message otherwise.
 */
export async function putSignedPhoto(entry: SignedUploadEntry, file: File): Promise<void> {
  const supabase = createClient();
  let lastErrorMsg = "Upload failed";
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
    try {
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .uploadToSignedUrl(entry.path, entry.token, file, {
          contentType: file.type,
          upsert: false,
        });
      if (!upErr) return;
      lastErrorMsg = upErr.message ?? "Upload failed";
      if (!isTransientUploadError(upErr)) break; // permanent failure, no point retrying
    } catch (err: any) {
      lastErrorMsg = err?.message ?? "Upload exception";
      if (!isTransientUploadError(err)) break;
    }
    if (attempt < MAX_UPLOAD_ATTEMPTS) {
      // Exponential backoff with jitter — 600/1500/3000ms-ish
      const backoff = 500 * Math.pow(2, attempt - 1) + Math.random() * 300;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw new Error(lastErrorMsg);
}

/**
 * Upload a single photo end-to-end (validate → resize → sign → PUT).
 * Returns the public URL. Throws with a user-facing message on failure.
 */
export async function uploadSinglePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image (JPG, PNG or WebP)");
  }
  const sized = await maybeResize(file);
  if (sized.size > MAX_FILE_BYTES) {
    throw new Error("Photo is too large (max 15MB even after resize)");
  }
  const { signed, errors } = await signPhotoUploads([sized]);
  const entry = signed[0];
  if (!entry) throw new Error(errors[0]?.error ?? "Sign failed");
  await putSignedPhoto(entry, sized);
  return entry.url;
}
