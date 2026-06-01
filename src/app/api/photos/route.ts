import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "item-photos";
const FOLDER = "items";

/**
 * GET /api/photos — List all available item photos in Supabase Storage.
 *
 * Replaces the old `public/items/` directory listing — that worked when
 * the catalog photos were committed to git, but Vercel's filesystem is
 * read-only at runtime, so admin uploads / deletes must round-trip
 * through Supabase Storage instead. The static directory has been wiped;
 * the bucket is now the single source of truth.
 *
 * Returns: { photos: [{ name, path, url, size?, updated_at? }] }
 *
 * Anyone signed in can list (PhotoPicker is admin-only on the page that
 * mounts it, but listing photos isn't sensitive — they're public assets).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from(BUCKET)
    .list(FOLDER, {
      limit: 1000,
      sortBy: { column: "updated_at", order: "desc" },
    });

  if (error) {
    console.error("Photos list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const photos = (data ?? [])
    .filter((f) => f.name && !f.name.startsWith(".")) // skip placeholder files
    .map((f) => {
      const path = `${FOLDER}/${f.name}`;
      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
      return {
        name: f.name,
        path,
        url: urlData.publicUrl,
        size: (f.metadata as any)?.size ?? null,
        updated_at: f.updated_at ?? null,
      };
    });

  return NextResponse.json({ photos });
}

/**
 * DELETE /api/photos — Remove one or many photos from Supabase Storage.
 *
 * Body: { paths: string[] } — full storage paths (e.g. ["items/foo.jpg"])
 *
 * Admin-only. Items whose `image_url` references a deleted photo end up
 * with a broken thumbnail; the catalog page already handles missing
 * images gracefully (placeholder background), and the next time admin
 * edits the item they can pick a new photo.
 */
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const auth = await requireAdmin(supabase);
  if (!auth.ok) return auth.response;

  let body: { paths: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const paths = Array.isArray(body.paths) ? body.paths.filter(Boolean) : [];
  if (paths.length === 0) {
    return NextResponse.json({ error: "No paths provided" }, { status: 400 });
  }

  // Defense: only allow paths inside the items/ folder. Stops a bad client
  // from passing "../something" or a different folder.
  const safePaths = paths.filter(
    (p) => typeof p === "string" && p.startsWith(`${FOLDER}/`) && !p.includes(".."),
  );
  if (safePaths.length === 0) {
    return NextResponse.json({ error: "No valid paths" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Capture public URLs BEFORE remove() so we can null out matching
  // items.image_url rows after the storage delete succeeds.
  const urlsBeingDeleted = safePaths.map((p) => {
    const { data } = admin.storage.from(BUCKET).getPublicUrl(p);
    return data.publicUrl;
  });

  const { data, error } = await admin.storage.from(BUCKET).remove(safePaths);

  if (error) {
    console.error("Photos delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Null out items.image_url for any items that referenced the deleted
  // photos — keeps the catalog grid consistent (placeholder thumb)
  // instead of leaving rows pointing at 404s. Logged but non-fatal:
  // the storage delete already succeeded by the time we get here.
  let itemsCleared = 0;
  let itemsClearError: string | null = null;
  try {
    const { data: cleared, error: clearErr } = await admin
      .from("items")
      .update({ image_url: null })
      .in("image_url", urlsBeingDeleted)
      .select("id");
    if (clearErr) {
      console.error("items.image_url clear after delete failed:", clearErr);
      itemsClearError = clearErr.message;
    } else {
      itemsCleared = cleared?.length ?? 0;
    }
  } catch (err: any) {
    console.error("items.image_url clear after delete threw:", err);
    itemsClearError = err?.message ?? "Unknown error";
  }

  return NextResponse.json({
    deleted: data?.length ?? 0,
    itemsCleared,
    itemsClearError,
  });
}
