/**
 * Brand image optimizer.
 *
 * Hand-illustrated flowers and logos were authored at 2048–3000px but render
 * at <=128px in the app, so the source PNGs (51MB flowers + 77MB logos) were
 * shipping 10–50x larger than any display size. This downsizes them IN PLACE,
 * keeping the PNG format, filename, and alpha channel — so no code, resolver,
 * offer-sheet, or React-Email reference changes (and WebP, unsafe in some mail
 * clients, is avoided). Originals remain recoverable from git history.
 *
 * Idempotent: skips files already within the cap, and never enlarges or writes
 * a result that isn't smaller than the source.
 *
 * Usage: node scripts/optimize-images.mjs
 */
import sharp from "sharp";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

// dir -> max width/height in px. Flowers are tiny in-app; logos can render a
// bit larger (login hero, install prompt), so they get a more generous cap.
const TARGETS = [
  { dir: "public/assets/pressfarm/flowers", max: 768 },
  { dir: "public/assets/pressfarm/logo", max: 1024 },
  { dir: "public/assets/logo", max: 1024 },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.png$/i.test(entry.name)) yield full;
  }
}

let totalBefore = 0, totalAfter = 0, changed = 0, skipped = 0;

for (const { dir, max } of TARGETS) {
  for await (const file of walk(dir)) {
    const before = (await stat(file)).size;
    totalBefore += before;
    const img = sharp(file);
    const meta = await img.metadata();
    const longest = Math.max(meta.width ?? 0, meta.height ?? 0);

    // Resize only if oversized; re-encode at max PNG compression either way.
    const pipeline = longest > max
      ? img.resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      : img;
    const out = await pipeline
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer();

    if (out.length < before) {
      await writeFile(file, out);
      totalAfter += out.length;
      changed++;
      const pct = Math.round((1 - out.length / before) * 100);
      console.log(`  ${kb(before)} -> ${kb(out.length)} (-${pct}%)  ${file}`);
    } else {
      totalAfter += before;
      skipped++;
    }
  }
}

console.log(
  `\nOptimized ${changed} file(s), skipped ${skipped}. ` +
  `Total ${(totalBefore / 1e6).toFixed(1)}MB -> ${(totalAfter / 1e6).toFixed(1)}MB ` +
  `(-${Math.round((1 - totalAfter / totalBefore) * 100)}%).`,
);
