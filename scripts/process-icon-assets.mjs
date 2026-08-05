// Asset-prep for clean, already-transparent AI-generated icons: trims the
// excess transparent padding down to the character's actual silhouette (plus
// a small margin), re-pads to a square, and downsamples to a sane game-asset
// size. No shape masking needed here — unlike the earlier batches, these
// sources have real alpha cutouts already, so the natural silhouette is used
// as-is rather than being forced into a circle/hex/diamond.
//
// Usage: node scripts/process-icon-assets.mjs

import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const SOURCES = [
  { symbol: "fox", file: "fox-source.png" },
  { symbol: "owl", file: "owl-source.png" },
  { symbol: "stag", file: "stag-source.png" },
  { symbol: "wisp", file: "wisp-source.png" },
  { symbol: "leaf", file: "leaf-source.png" },
  { symbol: "acorn", file: "acorn-source.png" },
  { symbol: "mushroom", file: "mushroom-source.png" },
  { symbol: "bloom", file: "bloom-source.png" },
  { symbol: "root", file: "root-source.png" },
  { symbol: "rot", file: "rot-source.png" },
  { symbol: "spirit-seed", file: "spirit-seed-source.png" }
];

const TARGET_SIZE = 420;
const ALPHA_THRESHOLD = 10;
const MARGIN_RATIO = 0.06; // fraction of the trimmed content's max dimension, added back on every side

function findContentBounds(data, w, h) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const a = data[(y * w + x) * 4 + 3];
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1 };
  return { minX, minY, maxX, maxY };
}

/** Nearest-neighbour sample into a square canvas of `size`, given a square source region [sx, sy, sSize]. */
function resampleSquare(src, srcW, sx, sy, sSize, size) {
  const dst = Buffer.alloc(size * size * 4);
  for (let dy = 0; dy < size; dy += 1) {
    const fy = sy + (dy / size) * sSize;
    for (let dx = 0; dx < size; dx += 1) {
      const fx = sx + (dx / size) * sSize;
      const di = (dy * size + dx) * 4;
      if (fx < 0 || fy < 0 || fx >= srcW || fy >= srcW) {
        dst[di + 3] = 0;
        continue;
      }
      // 2x2 box average for a bit of smoothing on the downsample.
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let oy = 0; oy < 2; oy += 1) {
        for (let ox = 0; ox < 2; ox += 1) {
          const sxx = Math.min(srcW - 1, Math.floor(fx) + ox);
          const syy = Math.min(srcW - 1, Math.floor(fy) + oy);
          const si = (syy * srcW + sxx) * 4;
          r += src[si];
          g += src[si + 1];
          b += src[si + 2];
          a += src[si + 3];
          count += 1;
        }
      }
      dst[di] = Math.round(r / count);
      dst[di + 1] = Math.round(g / count);
      dst[di + 2] = Math.round(b / count);
      dst[di + 3] = Math.round(a / count);
    }
  }
  return dst;
}

for (const { symbol, file } of SOURCES) {
  const srcPath = join(root, "art-source", "icons", file);
  const srcPng = PNG.sync.read(readFileSync(srcPath));
  const { width, height, data } = srcPng;

  const { minX, minY, maxX, maxY } = findContentBounds(data, width, height);
  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;
  const contentSize = Math.max(contentW, contentH);
  const margin = contentSize * MARGIN_RATIO;
  const squareSize = contentSize + margin * 2;

  const contentCx = (minX + maxX) / 2;
  const contentCy = (minY + maxY) / 2;
  const sx = contentCx - squareSize / 2;
  const sy = contentCy - squareSize / 2;

  const out = resampleSquare(data, width, sx, sy, squareSize, TARGET_SIZE);
  const png = new PNG({ width: TARGET_SIZE, height: TARGET_SIZE });
  out.copy(png.data);

  const outPath = join(root, "public", "assets", "wildwood", "symbols", `${symbol}.png`);
  writeFileSync(outPath, PNG.sync.write(png));
  console.log(`wrote ${outPath} (trimmed ${contentW}x${contentH} -> ${TARGET_SIZE}x${TARGET_SIZE})`);
}
