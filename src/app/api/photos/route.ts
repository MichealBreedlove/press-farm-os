import { NextResponse } from "next/server";
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const { data, error } = await admin.storage.from(BUCKET).remove(safePaths);

  if (error) {
    console.error("Photos delete error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: data?.length ?? 0 });
}
