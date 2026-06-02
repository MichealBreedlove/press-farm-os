/**
 * Open Graph card generator.
 *
 * Builds a 1200x630 social-share card on the brand cream ground with the
 * herbarium-style double gold hairline frame (mirrors /about), the botanical
 * mandala mark, and the wordmark + tagline beneath it. Composed from the
 * transparent brand PNGs so there's no font dependency — output is fully
 * deterministic and on-brand.
 *
 * Output: public/og-default.png  (referenced by src/app/layout.tsx metadata)
 *
 * Usage: node scripts/generate-og.mjs   (or: npm run generate:og)
 */
import sharp from "sharp";
import path from "node:path";

const W = 1200;
const H = 630;
const CREAM = "#faf7f0";
const GOLD = "#F0B530";

const MANDALA = "public/assets/pressfarm/logo/png/pressfarm-mandala-only.png";
const WORDMARK = "public/assets/pressfarm/logo/png/pressfarm-wordmark-tagline.png";
const OUT = "public/og-default.png";

// Double hairline frame, drawn as an SVG overlay the size of the canvas.
const frame = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
     <rect x="28" y="28" width="${W - 56}" height="${H - 56}"
           fill="none" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="2"/>
     <rect x="40" y="40" width="${W - 80}" height="${H - 80}"
           fill="none" stroke="${GOLD}" stroke-opacity="0.25" stroke-width="1"/>
   </svg>`,
);

// Mandala mark, upper-centered.
const mandala = await sharp(MANDALA)
  .resize({ height: 340, fit: "inside" })
  .toBuffer();
const { width: mw = 0, height: mh = 0 } = await sharp(mandala).metadata();

// Wordmark + tagline, centered below the mark.
const wordmark = await sharp(WORDMARK)
  .resize({ width: 460, fit: "inside" })
  .toBuffer();
const { width: ww = 0, height: wh = 0 } = await sharp(wordmark).metadata();

// Vertical layout: stack mark + wordmark as a group, centered on the canvas.
const gap = 36;
const groupH = mh + gap + wh;
const groupTop = Math.round((H - groupH) / 2);

await sharp({
  create: { width: W, height: H, channels: 4, background: CREAM },
})
  .composite([
    { input: mandala, left: Math.round((W - mw) / 2), top: groupTop },
    { input: wordmark, left: Math.round((W - ww) / 2), top: groupTop + mh + gap },
    { input: frame, left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(OUT);

const { default: fs } = await import("node:fs/promises");
const { size } = await fs.stat(OUT);
console.log(`Wrote ${path.resolve(OUT)} (${W}x${H}, ${(size / 1024).toFixed(0)}KB)`);
