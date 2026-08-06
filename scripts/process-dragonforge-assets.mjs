// Asset-prep for Dragonforge's AI-generated icons. These came back as
// opaque 1024x1024 squares with a painted vignette background rather than
// real alpha — attempts at automatic chroma-keying ended up eating into
// dark subject material (armor, hair, shadow) that's indistinguishable from
// the vignette by color alone. Instead of fighting that, the board applies
// a runtime Pixi mask per symbol's shape (circle/hexagon/diamond/jagged —
// see SYMBOL_SHAPE in dragonforge-pixi-board.tsx), so this script only
// needs to downsample the opaque squares to a sane game-asset size.
//
// Usage: node scripts/process-dragonforge-assets.mjs

import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const SOURCES = ["stone", "iron", "gold", "gem", "relic", "unstable-rock", "dragon-egg", "miner", "prospector", "smith", "scout"];
const TARGET_SIZE = 512;

function resampleSquare(src, srcSize, size) {
  const dst = Buffer.alloc(size * size * 4);
  const scale = srcSize / size;
  for (let dy = 0; dy < size; dy += 1) {
    for (let dx = 0; dx < size; dx += 1) {
      const di = (dy * size + dx) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      const sx0 = Math.floor(dx * scale);
      const sy0 = Math.floor(dy * scale);
      const sx1 = Math.min(srcSize, Math.floor((dx + 1) * scale));
      const sy1 = Math.min(srcSize, Math.floor((dy + 1) * scale));
      for (let sy = sy0; sy < Math.max(sy0 + 1, sy1); sy += 1) {
        for (let sx = sx0; sx < Math.max(sx0 + 1, sx1); sx += 1) {
          const si = (sy * srcSize + sx) * 4;
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

for (const symbol of SOURCES) {
  const srcPath = join(root, "art-source", "dragonforge", `${symbol}-source.png`);
  const srcPng = PNG.sync.read(readFileSync(srcPath));
  const { width, data } = srcPng;

  const out = resampleSquare(data, width, TARGET_SIZE);
  const png = new PNG({ width: TARGET_SIZE, height: TARGET_SIZE });
  out.copy(png.data);

  const outPath = join(root, "public", "assets", "dragonforge", "symbols", `${symbol}.png`);
  writeFileSync(outPath, PNG.sync.write(png));
  console.log(`wrote ${outPath} (${width}x${width} -> ${TARGET_SIZE}x${TARGET_SIZE})`);
}
