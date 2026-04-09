import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/photos — List all available item photos in public/items/
 */
export async function GET() {
  const dir = path.join(process.cwd(), "public", "items");
  try {
    const files = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
    files.sort();
    return NextResponse.json({ photos: files.map((f) => "/items/" + f) });
  } catch {
    return NextResponse.json({ photos: [] });
  }
}
