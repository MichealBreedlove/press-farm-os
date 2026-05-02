import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "item-photos";
const FOLDER = "items";

/**
 * POST /api/photos/rename — Rename a single photo in Supabase Storage.
 *
 * Body: { path, newName }
 *   - path:    full storage path of the existing object ("items/foo.jpg")
 *   - newName: bare new filename WITHOUT folder ("freshflower")
 *              extension is preserved automatically
 *
 * Returns: { path, name, url }
 *
 * Storage doesn't have a true rename — we use move(oldPath, newPath).
 * Items whose `image_url` references the old path will end up broken
 * (they keep the old URL, which now 404s). That's the same gap the
 * delete flow has — admin reassigns from the picker on the item edit
 * page. We may want a follow-up that updates `items.image_url` rows
 * to the new public URL, but for now keep this scoped.
 *
 * Admin-only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { path: string; newName: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { path, newName } = body;
  if (typeof path !== "string" || typeof newName !== "string") {
    return NextResponse.json({ error: "Missing path or newName" }, { status: 400 });
  }
  // Reject paths outside the items/ folder — same defense as DELETE.
  if (!path.startsWith(`${FOLDER}/`) || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const trimmed = newName.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  // Preserve original extension. Strip any extension the user typed and
  // sanitize aggressively — Supabase paths can contain a lot, but we
  // keep the catalog filenames URL-safe and consistent.
  const oldFile = path.slice(`${FOLDER}/`.length);
  const oldExt = oldFile.split(".").pop()?.toLowerCase() ?? "jpg";
  const cleanBase = trimmed
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  if (!cleanBase) {
    return NextResponse.json({ error: "Name produced no usable characters" }, { status: 400 });
  }
  const newFile = `${cleanBase}.${oldExt}`;
  const newPath = `${FOLDER}/${newFile}`;

  if (newPath === path) {
    // No-op — return the existing URL so the client can refresh state.
    const admin = createAdminClient();
    const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ path, name: oldFile, url: urlData.publicUrl, unchanged: true });
  }

  const admin = createAdminClient();

  // Bail early if the target name is already taken — Supabase move()
  // returns a generic "object exists" error otherwise.
  const { data: existing } = await (admin.storage.from(BUCKET) as any).list(FOLDER, {
    search: newFile,
    limit: 1,
  });
  if (Array.isArray(existing) && existing.some((f: any) => f.name === newFile)) {
    return NextResponse.json(
      { error: `A photo named "${newFile}" already exists` },
      { status: 409 },
    );
  }

  const { error } = await admin.storage.from(BUCKET).move(path, newPath);
  if (error) {
    console.error("Photo rename error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(newPath);
  return NextResponse.json({ path: newPath, name: newFile, url: urlData.publicUrl });
}
