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
 * Second pass — SMALL VARIANTS: a few brand images are used as tiny CSS
 * decorations or placeholders (a 14px eyebrow bullet, the 56–108px
 * page-header blossom, the 40px order-form placeholder wreath). Serving the
 * 768–1024px masters there cost 0.2–1.9MB per page for nothing, so this
 * writes a capped copy next to the source (see SMALL_VARIANTS) that CSS /
 * code point at. Also idempotent: a variant is only (re)written when it's
 * missing or older than its source.
 *
 * Usage: node scripts/optimize-images.mjs            # both passes
 *        node scripts/optimize-images.mjs --small-only  # just the variants
 */
import sharp from "sharp";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// source -> { out, max } (max = longest side in px; 2x the rendered size).
const SMALL_VARIANTS = [
  {
    // .section-eyebrow.with-flower::before — 14px bullet (globals.css)
    src: "public/assets/pressfarm/flowers/marigold-2.png",
    out: "public/assets/pressfarm/flowers/small/marigold-2.png",
    max: 128,
  },
  {
    // .page-header::after — 56px phone / 108px tablet (globals.css)
    src: "public/assets/pressfarm/logo/png/pressfarm-icon-squash-blossom-2.png",
    out: "public/assets/pressfarm/logo/png/small/pressfarm-icon-squash-blossom-2.png",
    max: 256,
  },
  {
    // PLACEHOLDER_WREATH (src/lib/flower-images.ts) — 40px order-form /
    // offer-sheet placeholder for items with no photo
    src: "public/assets/logo/png/logo-floral-only-transparent.png",
    out: "public/assets/pressfarm/logo/logo-floral-only-128.png",
    max: 128,
  },
];

async function writeSmallVariants() {
  let written = 0;
  for (const { src, out, max } of SMALL_VARIANTS) {
    const srcStat = await stat(src);
    const outStat = await stat(out).catch(() => null);
    if (outStat && outStat.mtimeMs >= srcStat.mtimeMs) continue;
    await mkdir(path.dirname(out), { recursive: true });
    const buf = await sharp(src)
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .png({ compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toBuffer();
    await writeFile(out, buf);
    written++;
    console.log(`  small ${kb(srcStat.size)} -> ${kb(buf.length)} (${max}px)  ${out}`);
  }
  console.log(`Small variants: ${written} written, ${SMALL_VARIANTS.length - written} up to date.`);
}

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

const smallOnly = process.argv.includes("--small-only");

for (const { dir, max } of smallOnly ? [] : TARGETS) {
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

if (!smallOnly) {
  console.log(
    `\nOptimized ${changed} file(s), skipped ${skipped}. ` +
    `Total ${(totalBefore / 1e6).toFixed(1)}MB -> ${(totalAfter / 1e6).toFixed(1)}MB ` +
    `(-${Math.round((1 - totalAfter / totalBefore) * 100)}%).`,
  );
}

await writeSmallVariants();
