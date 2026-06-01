import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "item-photos";
const FOLDER = "items";
const MAX_FILE_BYTES = 15 * 1024 * 1024; // mirror /api/upload/sign so policies stay consistent
const MAX_FILES_PER_REQUEST = 50;       // safety cap so a runaway upload can't DoS storage

/**
 * POST /api/upload/bulk — Upload many photos at once.
 *
 * Accepts multipart form data with one or more `files` fields. Uploads
 * each in parallel to the same `item-photos/items/` folder used by the
 * single /api/upload route. Returns per-file results so the client can
 * surface which uploaded vs. which failed.
 *
 * Filename strategy:
 *   slugified-original-{timestamp}-{idx}.{ext}
 * Suffix makes collisions effectively impossible across a single batch
 * even when the originals share names (e.g. multiple "IMG_0001.jpg" off
 * the same camera roll).
 *
 * Admin-only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((v): v is File => v instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many files in one batch (max ${MAX_FILES_PER_REQUEST}). Split into smaller batches.` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const batchTs = Date.now();

  // Run uploads in parallel — Supabase storage handles concurrent writes
  // fine, and we want the round-trip latency hidden by the slowest file
  // rather than summed across all of them.
  const results = await Promise.all(
    files.map(async (file, idx) => {
      if (!file.type.startsWith("image/")) {
        return { name: file.name, ok: false, error: "Not an image" };
      }
      if (file.size > MAX_FILE_BYTES) {
        return { name: file.name, ok: false, error: "File too large (max 15MB)" };
      }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const cleanName = file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 50);
      const filename = `${cleanName}-${batchTs}-${idx}.${ext}`;
      const storagePath = `${FOLDER}/${filename}`;

      try {
        const bytes = await file.arrayBuffer();
        const { data, error } = await admin.storage
          .from(BUCKET)
          .upload(storagePath, bytes, { contentType: file.type, upsert: false });

        if (error || !data) {
          return { name: file.name, ok: false, error: error?.message ?? "Upload failed" };
        }

        const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(data.path);
        return { name: file.name, ok: true, path: data.path, url: urlData.publicUrl };
      } catch (err: any) {
        return { name: file.name, ok: false, error: err?.message ?? "Upload exception" };
      }
    }),
  );

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  return NextResponse.json({ succeeded, failed, results });
}
