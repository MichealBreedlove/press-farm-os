/**
 * SVG logo raster shrinker.
 *
 * The brand logo SVGs keep the wordmark/tagline as real vector text but embed
 * the hand-illustrated mandala as a full-resolution base64 PNG (~3–4MB each,
 * eight files ≈ 28MB). The mandala renders at <=512px anywhere in the app, so
 * this downsizes each embedded raster IN PLACE to a 1024px cap — same SVG
 * structure, same filenames, fonts stay vector. Originals remain recoverable
 * from git history.
 *
 * Idempotent: skips SVGs whose embedded raster is already within the cap, and
 * never writes a result that isn't smaller than the source.
 *
 * Usage: node scripts/optimize-svg-logos.mjs
 */
import sharp from "sharp";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;
const MAX_PX = 1024;
const DIRS = ["public/assets/pressfarm/logo", "public/assets/logo/svg"];
const DATA_URI_RE = /data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)/g;

let totalBefore = 0;
let totalAfter = 0;

for (const dir of DIRS) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    continue;
  }
  for (const name of entries) {
    if (!name.toLowerCase().endsWith(".svg")) continue;
    const file = path.join(dir, name);
    const before = (await stat(file)).size;
    const svg = await readFile(file, "utf8");

    let changed = false;
    let out = svg;
    for (const match of svg.matchAll(DATA_URI_RE)) {
      const [full, , b64] = match;
      const buf = Buffer.from(b64, "base64");
      const meta = await sharp(buf).metadata();
      if (!meta.width || Math.max(meta.width, meta.height ?? 0) <= MAX_PX) continue;
      const resized = await sharp(buf)
        .resize({ width: MAX_PX, height: MAX_PX, fit: "inside", withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true })
        .toBuffer();
      if (resized.length >= buf.length) continue;
      out = out.replace(full, `data:image/png;base64,${resized.toString("base64")}`);
      changed = true;
    }

    if (changed && out.length < svg.length) {
      await writeFile(file, out, "utf8");
      const after = (await stat(file)).size;
      totalBefore += before;
      totalAfter += after;
      console.log(`✓ ${file}  ${kb(before)} → ${kb(after)}`);
    } else {
      console.log(`· ${file}  ${kb(before)} (already optimal)`);
    }
  }
}

if (totalBefore > 0) {
  console.log(`\nTotal: ${kb(totalBefore)} → ${kb(totalAfter)}`);
}
