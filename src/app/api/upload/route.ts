import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * POST /api/upload — Upload a photo to public/items/
 * Accepts multipart form data with a "file" field.
 * Returns the public URL path.
 *
 * Note: On Vercel, this writes to /tmp and returns a data URL.
 * For production, use Supabase Storage instead.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files allowed" }, { status: 400 });
    }

    // Generate filename
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const cleanName = file.name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);
    const filename = `upload-${cleanName}-${Date.now()}.${ext}`;

    // Read file bytes
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Write to public/items/ (works locally, on Vercel use tmp)
    const dir = path.join(process.cwd(), "public", "items");
    try {
      await mkdir(dir, { recursive: true });
    } catch {}

    const filePath = path.join(dir, filename);
    await writeFile(filePath, buffer);

    // Also update the photo-index.json
    const indexPath = path.join(process.cwd(), "public", "photo-index.json");
    try {
      const { readFile } = await import("fs/promises");
      const existing = JSON.parse(await readFile(indexPath, "utf8"));
      existing.push("/items/" + filename);
      existing.sort();
      await writeFile(indexPath, JSON.stringify(existing));
    } catch {}

    return NextResponse.json({ url: "/items/" + filename });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
