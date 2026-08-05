import { Assets, type Texture } from "pixi.js";
import type { SymbolType } from "@/lib/wildwood";

const ASSET_BASE = "/assets/wildwood";

/**
 * Filename (including extension) per symbol, relative to `symbols/`.
 * Every symbol now ships as an AI-generated portrait, pre-cropped to the
 * shape that already carries meaning on the board — circle for resources,
 * hexagon for collectors, diamond for the bonus-trigger seed, and a jagged
 * outline for rot — with real alpha baked in by scripts/process-*.mjs.
 */
const SYMBOL_FILE: Record<SymbolType, string> = {
  leaf: "leaf.png",
  acorn: "acorn.png",
  mushroom: "mushroom.png",
  bloom: "bloom.png",
  root: "root.png",
  rot: "rot.png",
  spiritSeed: "spirit-seed.png",
  fox: "fox.png",
  owl: "owl.png",
  stag: "stag.png",
  wisp: "wisp.png"
};

export const SYMBOL_ALIASES = Object.fromEntries(
  (Object.keys(SYMBOL_FILE) as SymbolType[]).map((symbol) => [symbol, `symbol-${symbol}`])
) as Record<SymbolType, string>;

/** Source paths for the raw icon files, for use in plain DOM `<img>` contexts (e.g. a legend). */
export const SYMBOL_ICON_SRC = Object.fromEntries(
  (Object.keys(SYMBOL_FILE) as SymbolType[]).map((symbol) => [symbol, `${ASSET_BASE}/symbols/${SYMBOL_FILE[symbol]}`])
) as Record<SymbolType, string>;

export const WILDWOOD_TEXTURE_KEYS = {
  tile: "tile-wood",
  tileBonus: "tile-wood-bonus",
  vignette: "board-vignette",
  glow: "particle-glow",
  treeline: "bg-treeline-far",
  canopyLight: "bg-canopy-light",
  mist: "bg-mist",
  foliage: "frame-foliage",
  sparkle: "sparkle",
  spotlight: "spotlight",
  shineSweep: "shine-sweep",
  ringPulse: "ring-pulse"
} as const;

let loadPromise: Promise<void> | null = null;

/** Loads every Wildwood texture once, rasterizing SVGs at 2x for crisp small-tile rendering. */
export function loadWildwoodAssets(): Promise<void> {
  loadPromise ??= (async () => {
    const assets = [
      ...(Object.keys(SYMBOL_FILE) as SymbolType[]).map((symbol) => ({
        alias: SYMBOL_ALIASES[symbol],
        src: `${ASSET_BASE}/symbols/${SYMBOL_FILE[symbol]}`,
        // Only SVGs need a rasterization-resolution hint; the collector PNGs are already raster.
        data: SYMBOL_FILE[symbol].endsWith(".svg") ? { resolution: 2 } : undefined
      })),
      { alias: WILDWOOD_TEXTURE_KEYS.tile, src: `${ASSET_BASE}/tile-wood.svg`, data: { resolution: 2 } },
      { alias: WILDWOOD_TEXTURE_KEYS.tileBonus, src: `${ASSET_BASE}/tile-wood-bonus.svg`, data: { resolution: 2 } },
      { alias: WILDWOOD_TEXTURE_KEYS.vignette, src: `${ASSET_BASE}/board-vignette.svg`, data: { resolution: 1 } },
      { alias: WILDWOOD_TEXTURE_KEYS.glow, src: `${ASSET_BASE}/particle-glow.svg`, data: { resolution: 2 } },
      { alias: WILDWOOD_TEXTURE_KEYS.treeline, src: `${ASSET_BASE}/bg-treeline-far.svg`, data: { resolution: 1 } },
      { alias: WILDWOOD_TEXTURE_KEYS.canopyLight, src: `${ASSET_BASE}/bg-canopy-light.svg`, data: { resolution: 1 } },
      { alias: WILDWOOD_TEXTURE_KEYS.mist, src: `${ASSET_BASE}/bg-mist.svg`, data: { resolution: 1 } },
      { alias: WILDWOOD_TEXTURE_KEYS.foliage, src: `${ASSET_BASE}/frame-foliage.svg`, data: { resolution: 1 } },
      { alias: WILDWOOD_TEXTURE_KEYS.sparkle, src: `${ASSET_BASE}/sparkle.svg`, data: { resolution: 2 } },
      { alias: WILDWOOD_TEXTURE_KEYS.spotlight, src: `${ASSET_BASE}/spotlight.svg`, data: { resolution: 1 } },
      { alias: WILDWOOD_TEXTURE_KEYS.shineSweep, src: `${ASSET_BASE}/shine-sweep.svg`, data: { resolution: 2 } },
      { alias: WILDWOOD_TEXTURE_KEYS.ringPulse, src: `${ASSET_BASE}/ring-pulse.svg`, data: { resolution: 2 } }
    ];
    Assets.add(assets);
    await Assets.load(assets.map((asset) => asset.alias));
  })();
  return loadPromise;
}

export function getSymbolTexture(symbol: SymbolType): Texture {
  return Assets.get(SYMBOL_ALIASES[symbol]);
}

export function getWildwoodTexture(key: (typeof WILDWOOD_TEXTURE_KEYS)[keyof typeof WILDWOOD_TEXTURE_KEYS]): Texture {
  return Assets.get(key);
}
