import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "item-photos";
const FOLDER = "items";
// 15MB final cap. Client-side autoresize compresses anything over ~5MB
// down to fit within 2400x2400 JPEG, so this is a safety net for files
// the resizer can't handle (HEIC the browser refused to decode, etc.).
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 50;

/**
 * POST /api/upload/sign — Mint signed upload URLs for direct browser-to-Supabase uploads.
 *
 * Why not just upload through /api/upload/bulk? Vercel's API routes cap the
 * request body at 4.5MB total — a batch of 25 photos easily exceeds that
 * even at 200KB/each, and the platform returns an HTML "Request Entity
 * Too Large" page that breaks our JSON parser. Signed URLs let the browser
 * PUT each file straight to Supabase Storage, bypassing Vercel entirely
 * for the actual bytes.
 *
 * Body: { files: [{ name, type, size }] }
 * Returns: { signed: [{ name, path, token, sourceName }], errors: [...] }
 *
 * The client then calls supabase.storage.uploadToSignedUrl(path, token, file)
 * for each entry. Admin-only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: { files: { name: string; type: string; size: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.files) || body.files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (body.files.length > MAX_FILES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Too many files in one batch (max ${MAX_FILES_PER_REQUEST})` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const batchTs = Date.now();

  const signed: Array<{ name: string; path: string; token: string; sourceName: string; url: string }> = [];
  const errors: Array<{ name: string; error: string }> = [];

  // Mint signed URLs in parallel — each createSignedUploadUrl is a single
  // round-trip to Supabase, no reason to serialize them.
  await Promise.all(
    body.files.map(async (f, idx) => {
      if (!f?.name || typeof f.name !== "string") {
        errors.push({ name: String(f?.name ?? "?"), error: "Missing filename" });
        return;
      }
      if (typeof f.type !== "string" || !f.type.startsWith("image/")) {
        errors.push({ name: f.name, error: "Not an image" });
        return;
      }
      if (typeof f.size !== "number" || f.size > MAX_FILE_BYTES) {
        errors.push({ name: f.name, error: "File too large (max 15MB)" });
        return;
      }

      const ext = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const cleanName = f.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 50);
      const path = `${FOLDER}/${cleanName}-${batchTs}-${idx}.${ext}`;

      try {
        const { data, error } = await (admin.storage.from(BUCKET) as any)
          .createSignedUploadUrl(path);
        if (error || !data) {
          errors.push({ name: f.name, error: error?.message ?? "Sign failed" });
          return;
        }
        const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
        signed.push({
          name: cleanName,
          path,
          token: data.token,
          sourceName: f.name,
          url: urlData.publicUrl,
        });
      } catch (err: any) {
        errors.push({ name: f.name, error: err?.message ?? "Sign exception" });
      }
    }),
  );

  return NextResponse.json({ signed, errors });
}
