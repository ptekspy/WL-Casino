import { Assets, type Texture } from "pixi.js";
import type { SymbolType } from "@/lib/dragonforge";

const ASSET_BASE = "/assets/dragonforge";

/**
 * Filename per symbol, relative to `symbols/`. These are opaque
 * AI-generated portraits with a painted vignette background rather than
 * real alpha cutouts — the board masks each sprite to its symbol's shape
 * (circle/hexagon/diamond/jagged, see SYMBOL_SHAPE in
 * dragonforge-pixi-board.tsx) at render time instead of relying on
 * pre-cropped transparency.
 */
const SYMBOL_FILE: Record<SymbolType, string> = {
  stone: "stone.png",
  iron: "iron.png",
  gold: "gold.png",
  gem: "gem.png",
  relic: "relic.png",
  unstableRock: "unstable-rock.png",
  dragonEgg: "dragon-egg.png",
  miner: "miner.png",
  prospector: "prospector.png",
  smith: "smith.png",
  scout: "scout.png"
};

const SYMBOL_ALIASES = Object.fromEntries(
  (Object.keys(SYMBOL_FILE) as SymbolType[]).map((symbol) => [symbol, `df-symbol-${symbol}`])
) as Record<SymbolType, string>;

/** Source paths for the raw icon files, for use in plain DOM `<img>` contexts (e.g. a legend). */
export const DRAGONFORGE_SYMBOL_ICON_SRC = Object.fromEntries(
  (Object.keys(SYMBOL_FILE) as SymbolType[]).map((symbol) => [symbol, `${ASSET_BASE}/symbols/${SYMBOL_FILE[symbol]}`])
) as Record<SymbolType, string>;

let loadPromise: Promise<void> | null = null;

/** Loads every Dragonforge symbol texture once. */
export function loadDragonforgeAssets(): Promise<void> {
  loadPromise ??= (async () => {
    const assets = (Object.keys(SYMBOL_FILE) as SymbolType[]).map((symbol) => ({
      alias: SYMBOL_ALIASES[symbol],
      src: `${ASSET_BASE}/symbols/${SYMBOL_FILE[symbol]}`
    }));
    Assets.add(assets);
    await Assets.load(assets.map((asset) => asset.alias));
  })();
  return loadPromise;
}

export function getDragonforgeSymbolTexture(symbol: SymbolType): Texture {
  return Assets.get(SYMBOL_ALIASES[symbol]);
}
