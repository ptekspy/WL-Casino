"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite, Text, TextStyle, type Texture, type Ticker } from "pixi.js";
import type { BoardCell, CollectorType, SymbolType, WildwoodRoundResult, WildwoodStep } from "@/lib/wildwood";
import { WILDWOOD_CONFIG, buildFrames } from "@/lib/wildwood";
import { WILDWOOD_TEXTURE_KEYS, getSymbolTexture, getWildwoodTexture, loadWildwoodAssets } from "@/lib/pixi/assets";
import { Easing, TweenRunner } from "@/lib/pixi/tween";
import { wildwoodSound } from "@/lib/pixi/sound";

const { width: COLS, height: ROWS } = WILDWOOD_CONFIG;
const CELL = 100;
const GAP = 8;
const FRAME_PAD = 34;
const TOP_BAR = 104;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP;
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP;
const DESIGN_W = BOARD_W + FRAME_PAD * 2;
const DESIGN_H = BOARD_H + FRAME_PAD * 2 + TOP_BAR;
export const WILDWOOD_BOARD_ASPECT = `${DESIGN_W} / ${DESIGN_H}`;

const SYMBOL_COLORS: Record<SymbolType, number> = {
  leaf: 0x34d399,
  acorn: 0xf59e0b,
  mushroom: 0xef4444,
  bloom: 0xf472b6,
  root: 0xf97316,
  rot: 0x8b7a9e,
  spiritSeed: 0x22d3ee,
  fox: 0xf97316,
  owl: 0x38bdf8,
  stag: 0x84cc16,
  wisp: 0xe879f9
};

const NEIGHBOURS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]
] as const;

function isCollectorSymbol(symbol: SymbolType): symbol is CollectorType {
  return symbol === "fox" || symbol === "owl" || symbol === "stag" || symbol === "wisp";
}

function coordKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function lerpColor(from: number, to: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(fr + (tr - fr) * clamped);
  const g = Math.round(fg + (tg - fg) * clamped);
  const b = Math.round(fb + (tb - fb) * clamped);
  return (r << 16) | (g << 8) | b;
}

export type WildwoodBoardHandle = {
  /** Instantly jumps to a step, cancelling any in-flight autoplay. */
  seek: (stepIndex: number) => void;
  /** Instantly jumps to the final step of the current round. */
  skipToEnd: () => void;
};

type WildwoodPixiBoardProps = {
  round: WildwoodRoundResult | null;
  onStepChange?: (stepIndex: number, step: WildwoodStep, totalSteps: number) => void;
  onRoundComplete?: (round: WildwoodRoundResult) => void;
};

export const WildwoodPixiBoard = forwardRef<WildwoodBoardHandle, WildwoodPixiBoardProps>(function WildwoodPixiBoard(
  { round, onStepChange, onRoundComplete },
  ref
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<BoardWorld | null>(null);
  const lastRoundIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      seek: (index) => worldRef.current?.seek(index),
      skipToEnd: () => worldRef.current?.skipToEnd()
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host) return;

    const app = new Application();
    let resizeObserver: ResizeObserver | null = null;
    // Tracks whether `app.init()` has resolved, so init and cleanup never both call
    // `app.destroy()` on the same app — React Strict Mode's dev-only double-invoke
    // (mount -> cleanup -> mount) can otherwise run cleanup while init is still
    // in flight, and a second destroy() call crashes inside Pixi's ResizePlugin.
    let initialized = false;

    (async () => {
      await app.init({
        resizeTo: host,
        antialias: true,
        backgroundAlpha: 0,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true
      });
      if (cancelled) {
        app.destroy(true, { children: true, texture: true });
        return;
      }
      initialized = true;
      host.appendChild(app.canvas);

      await loadWildwoodAssets();
      if (cancelled) return;

      const world = buildWorld(app);
      worldRef.current = world;
      world.resize();

      resizeObserver = new ResizeObserver(() => world.resize());
      resizeObserver.observe(host);

      setReady(true);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      worldRef.current?.destroy();
      worldRef.current = null;
      if (initialized) {
        app.destroy(true, { children: true, texture: true });
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !round) return;
    if (lastRoundIdRef.current === round.roundId) return;
    lastRoundIdRef.current = round.roundId;
    worldRef.current?.playRound(round, onStepChange, onRoundComplete);
  }, [ready, round, onStepChange, onRoundComplete]);

  return <div ref={hostRef} className="relative h-full w-full overflow-hidden rounded-[1.75rem]" />;
});

type CellView = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  symbol: SymbolType | null;
  container: Container;
  tileSprite: Sprite;
  glow: Graphics;
  shadowSprite: Sprite;
  symbolSprite: Sprite;
  bevel: Graphics;
  flash: Graphics;
  valueBg: Graphics;
  valueLabel: Text;
  targetsBg: Graphics;
  targetIcons: Sprite[];
  targetsAnyLabel: Text;
};

type BoardWorld = {
  resize: () => void;
  playRound: (
    round: WildwoodRoundResult,
    onStepChange?: (index: number, step: WildwoodStep, total: number) => void,
    onComplete?: (round: WildwoodRoundResult) => void
  ) => void;
  seek: (index: number) => void;
  skipToEnd: () => void;
  destroy: () => void;
};

function pacingDelay(step: WildwoodStep): number {
  switch (step.type) {
    case "boardGenerated": return 280;
    case "symbolsCollected": return 140;
    case "cascade": return 300;
    case "bonusTriggered": return 140;
    case "bonusBreath": return 220;
    case "bonusEnded": return 260;
    case "roundEnded": return 0;
    default: return 160;
  }
}

function buildWorld(app: Application): BoardWorld {
  const runner = new TweenRunner(app.ticker);

  const root = new Container();
  app.stage.addChild(root);

  // A dedicated inner container so screen-shake can jitter it without
  // fighting the resize-driven scale/position on `root`.
  const shakeContainer = new Container();
  root.addChild(shakeContainer);

  const bg = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.vignette));
  bg.width = DESIGN_W;
  bg.height = DESIGN_H;
  shakeContainer.addChild(bg);

  // Parallax forest backdrop: far silhouette treeline, soft canopy light beams,
  // and a drifting mist band, each nudged slowly and independently for depth.
  const treeline = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.treeline));
  treeline.width = DESIGN_W + 60;
  treeline.height = (DESIGN_W + 60) * 0.5;
  treeline.position.set(-30, DESIGN_H - treeline.height + 40);
  treeline.alpha = 0.9;
  shakeContainer.addChild(treeline);

  const canopyLight = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.canopyLight));
  canopyLight.width = DESIGN_W;
  canopyLight.height = DESIGN_H;
  canopyLight.blendMode = "add";
  canopyLight.alpha = 0.55;
  shakeContainer.addChild(canopyLight);

  const mist = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.mist));
  mist.width = DESIGN_W + 200;
  mist.height = (DESIGN_W + 200) * 0.22;
  mist.position.set(-100, DESIGN_H - mist.height * 0.7);
  shakeContainer.addChild(mist);

  let driftPhase = 0;
  const driftTicker = (ticker: Ticker) => {
    driftPhase += ticker.deltaMS / 1000;
    treeline.position.x = -30 + Math.sin(driftPhase * 0.05) * 14;
    canopyLight.alpha = 0.48 + Math.sin(driftPhase * 0.3) * 0.08;
    mist.position.x = -100 + Math.sin(driftPhase * 0.08) * 40;
  };
  app.ticker.add(driftTicker);

  const statusStyle = new TextStyle({
    fill: 0xd7f5e6,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "system-ui, -apple-system, sans-serif",
    align: "center",
    wordWrap: true,
    // Sits below the badge row (see TOP_BAR), so it only needs to clear the
    // frame padding, not stay narrow enough to dodge the corner badges.
    wordWrapWidth: DESIGN_W - 2 * FRAME_PAD
  });
  const statusText = new Text({ text: "Press play to grow the Wildwood.", style: statusStyle });
  statusText.anchor.set(0.5, 0);
  statusText.position.set(DESIGN_W / 2, 58);
  shakeContainer.addChild(statusText);

  const multiplierBadge = buildMultiplierBadge();
  multiplierBadge.container.position.set(DESIGN_W - 16, 16);
  shakeContainer.addChild(multiplierBadge.container);

  const potBadge = buildPotBadge();
  potBadge.container.position.set(82, 26);
  shakeContainer.addChild(potBadge.container);

  const seedTracker = buildSeedTracker(WILDWOOD_CONFIG.bonusTriggerSeeds);
  seedTracker.container.position.set(DESIGN_W / 2, 16);
  shakeContainer.addChild(seedTracker.container);

  const frameGraphics = new Graphics();
  frameGraphics.position.set(FRAME_PAD, TOP_BAR + FRAME_PAD);
  shakeContainer.addChild(frameGraphics);
  drawBoardFrame(frameGraphics);

  const boardContainer = new Container();
  boardContainer.position.set(FRAME_PAD, TOP_BAR + FRAME_PAD);
  shakeContainer.addChild(boardContainer);

  const ambientField = new ParticleField(app.ticker, getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.glow), BOARD_W, BOARD_H);
  boardContainer.addChild(ambientField.container);

  const cells: CellView[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = buildCellView(x, y);
      boardContainer.addChild(cell.container);
      cells.push(cell);
    }
  }

  // Cinematic center spotlight — warms and focuses the middle of the grid.
  const spotlight = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.spotlight));
  spotlight.anchor.set(0.5);
  spotlight.width = BOARD_W * 1.3;
  spotlight.height = BOARD_W * 1.3;
  spotlight.position.set(BOARD_W / 2, BOARD_H / 2);
  spotlight.blendMode = "add";
  spotlight.alpha = 0.8;
  spotlight.eventMode = "none";
  boardContainer.addChild(spotlight);

  const fxLayer = new Container();
  boardContainer.addChild(fxLayer);
  const celebrationField = new ParticleField(app.ticker, getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.sparkle), BOARD_W, BOARD_H);
  celebrationField.setMode("off");
  boardContainer.addChild(celebrationField.container);

  // Vine clusters draping over the top corners of the frame, in front of the grid.
  const foliage = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.foliage));
  foliage.width = BOARD_W + 28;
  foliage.height = (BOARD_W + 28) * (220 / 760);
  foliage.position.set(-14, -34);
  foliage.eventMode = "none";
  boardContainer.addChild(foliage);

  let glowPulse = 0;
  const pulseTicker = (ticker: Ticker) => {
    glowPulse += ticker.deltaMS / 1000;
    for (const cell of cells) {
      if (cell.symbol) {
        // Gentle idle life so the board never looks frozen between plays —
        // collectors "breathe" a bit more than plain resource symbols.
        const phase = cell.x * 1.7 + cell.y * 2.3;
        const amplitude = isCollectorSymbol(cell.symbol) ? 0.05 : 0.022;
        cell.symbolSprite.rotation = Math.sin(glowPulse * 1.3 + phase) * amplitude;
      }
      if (cell.glow.alpha === 0 && !cell.symbol) continue;
      cell.glow.alpha = 0.55 + Math.sin(glowPulse * 2 + cell.x * 0.7 + cell.y * 0.5) * 0.35;
    }
  };
  app.ticker.add(pulseTicker);

  function shakeScreen(intensity: number, durationMs: number) {
    void runner
      .animate(durationMs, (p) => {
        const decay = 1 - p;
        shakeContainer.position.set((Math.random() * 2 - 1) * intensity * decay, (Math.random() * 2 - 1) * intensity * decay);
      })
      .then(() => shakeContainer.position.set(0, 0));
  }

  function cellAt(x: number, y: number): CellView {
    return cells[y * COLS + x];
  }

  function applyCellSymbol(cell: CellView, symbol: SymbolType) {
    const texture = getSymbolTexture(symbol);
    cell.symbol = symbol;
    cell.symbolSprite.texture = texture;
    cell.symbolSprite.width = CELL * 0.8;
    cell.symbolSprite.height = CELL * 0.8;
    cell.shadowSprite.texture = texture;
    cell.shadowSprite.width = CELL * 0.8;
    cell.shadowSprite.height = CELL * 0.8;
    drawGlow(cell);
    drawValueLabel(cell);
    drawCollectorTargets(cell);
  }

  /**
   * Collectors only claim specific neighbour symbols, and that's never been
   * obvious in play. Show the actual target icons right on the collector tile.
   */
  function drawCollectorTargets(cell: CellView) {
    cell.targetsBg.clear();
    cell.targetsAnyLabel.visible = false;
    for (const icon of cell.targetIcons) icon.visible = false;

    const symbol = cell.symbol;
    if (!symbol || !isCollectorSymbol(symbol)) return;
    const targets = WILDWOOD_CONFIG.collectorTargets[symbol];

    if (targets.length > 3) {
      // wisp collects almost everything — naming all six would be clutter, not clarity.
      cell.targetsBg
        .roundRect(CELL / 2 - 24, 6, 48, 22, 10)
        .fill({ color: 0x1c1206, alpha: 0.8 })
        .stroke({ width: 1, color: 0xffe9a8, alpha: 0.4 });
      cell.targetsAnyLabel.visible = true;
      return;
    }

    cell.targetsBg
      .roundRect(CELL / 2 - 38, 6, 76, 24, 10)
      .fill({ color: 0x1c1206, alpha: 0.8 })
      .stroke({ width: 1, color: 0xffe9a8, alpha: 0.35 });
    targets.forEach((target, i) => {
      const icon = cell.targetIcons[i];
      icon.texture = getSymbolTexture(target);
      icon.width = 18;
      icon.height = 18;
      icon.position.set(CELL / 2 - 24 + i * 24, 18);
      icon.visible = true;
    });
  }

  /**
   * Puts each symbol's worth right on the tile — collectors get a bold gold
   * "this wins" multiplier chip, plain symbols get a quiet value chip, and rot
   * gets nothing at all, so its worthlessness reads without checking the legend.
   */
  function drawValueLabel(cell: CellView) {
    cell.valueBg.clear();
    if (!cell.symbol || cell.symbol === "rot") {
      cell.valueLabel.text = "";
      return;
    }
    const symbol = cell.symbol;
    const isCollector = isCollectorSymbol(symbol);
    const label = isCollector ? `${WILDWOOD_CONFIG.collectorMultipliers[symbol]}x` : `${WILDWOOD_CONFIG.symbolValues[symbol].toFixed(2)}x`;
    cell.valueLabel.text = label;
    cell.valueLabel.style.fill = isCollector ? 0x2a1704 : 0xffffff;
    const halfWidth = cell.valueLabel.width / 2 + 7;
    cell.valueBg
      .roundRect(CELL / 2 - halfWidth, CELL - 22, halfWidth * 2, 18, 9)
      .fill({ color: isCollector ? 0xf5c542 : 0x000000, alpha: isCollector ? 0.92 : 0.55 })
      .stroke({ width: 1, color: isCollector ? 0x8a5a12 : 0xffffff, alpha: isCollector ? 0.6 : 0.15 });
  }

  function drawGlow(cell: CellView) {
    cell.glow.clear();
    if (!cell.symbol) return;
    if (isCollectorSymbol(cell.symbol)) {
      cell.glow.circle(CELL / 2, CELL / 2, CELL * 0.47).stroke({ width: 3, color: SYMBOL_COLORS[cell.symbol], alpha: 0.6 });
    } else if (cell.symbol === "spiritSeed") {
      cell.glow.circle(CELL / 2, CELL / 2, CELL * 0.47).stroke({ width: 2.5, color: SYMBOL_COLORS.spiritSeed, alpha: 0.5 });
    }
  }

  function setBonusTiles(active: boolean) {
    const texture = getWildwoodTexture(active ? WILDWOOD_TEXTURE_KEYS.tileBonus : WILDWOOD_TEXTURE_KEYS.tile);
    for (const cell of cells) cell.tileSprite.texture = texture;
    ambientField.setMode(active ? "bonus" : "idle");
  }

  function setBoardInstant(board: BoardCell[]) {
    for (const cell of cells) {
      const data = board[cell.y * COLS + cell.x];
      applyCellSymbol(cell, data.symbol);
      cell.container.alpha = 1;
      cell.container.scale.set(1);
      cell.container.position.set(cell.baseX, cell.baseY);
      cell.symbolSprite.scale.x = 1;
      cell.symbolSprite.scale.y = 1;
      cell.shadowSprite.scale.x = 1;
      cell.shadowSprite.scale.y = 1;
    }
  }

  function clearFx() {
    fxLayer.removeChildren().forEach((child) => child.destroy());
  }

  async function playIntro(board: BoardCell[], gen: number) {
    const jobs = cells.map((cell) => {
      const data = board[cell.y * COLS + cell.x];
      applyCellSymbol(cell, data.symbol);
      cell.container.alpha = 0;
      cell.container.scale.set(0.5);
      cell.container.position.set(cell.baseX, cell.baseY - 26);
      const delay = (cell.x + cell.y) * 26;
      return (async () => {
        await runner.wait(delay);
        if (gen !== currentGeneration) return;
        await runner.animate(320, (p) => {
          const eased = Easing.outBack(p);
          cell.container.alpha = Math.min(1, p * 1.4);
          cell.container.scale.set(0.5 + eased * 0.5);
          cell.container.position.y = cell.baseY - 26 * (1 - p);
        });
      })();
    });
    await Promise.all(jobs);
  }

  type CollectionLink = { sx: number; sy: number; tx: number; ty: number; color: number };

  /** Mirrors the server's adjacency rule client-side, purely for beam/lunge visuals. */
  function findCollectionLinks(prevBoard: BoardCell[], collectedSet: Set<string>): CollectionLink[] {
    const links: CollectionLink[] = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const source = prevBoard[y * COLS + x];
        if (!isCollectorSymbol(source.symbol)) continue;
        const targets = WILDWOOD_CONFIG.collectorTargets[source.symbol];
        for (const [dx, dy] of NEIGHBOURS) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          if (!collectedSet.has(coordKey(nx, ny))) continue;
          const target = prevBoard[ny * COLS + nx];
          if (!(targets as readonly SymbolType[]).includes(target.symbol)) continue;
          links.push({ sx: x, sy: y, tx: nx, ty: ny, color: SYMBOL_COLORS[source.symbol] });
        }
      }
    }
    return links;
  }

  function drawBeamsFromLinks(links: readonly CollectionLink[]): Graphics {
    const g = new Graphics();
    for (const link of links) {
      const [cx1, cy1] = cellCenter(link.sx, link.sy);
      const [cx2, cy2] = cellCenter(link.tx, link.ty);
      g.moveTo(cx1, cy1).lineTo(cx2, cy2).stroke({ width: 3, color: link.color, alpha: 0.75 });
    }
    fxLayer.addChild(g);
    return g;
  }

  /** Each collector nudges toward what it's collecting — a tiny "attack" motion so the board feels alive. */
  function lungeCollectors(links: readonly CollectionLink[]) {
    const bySource = new Map<string, { x: number; y: number; dx: number; dy: number; count: number }>();
    for (const link of links) {
      const key = coordKey(link.sx, link.sy);
      const entry = bySource.get(key) ?? { x: link.sx, y: link.sy, dx: 0, dy: 0, count: 0 };
      entry.dx += link.tx - link.sx;
      entry.dy += link.ty - link.sy;
      entry.count += 1;
      bySource.set(key, entry);
    }
    for (const { x, y, dx, dy, count } of bySource.values()) {
      const cell = cellAt(x, y);
      const len = Math.hypot(dx, dy) || 1;
      const nudgeX = (dx / len / count) * 10;
      const nudgeY = (dy / len / count) * 10;
      void runner
        .animate(280, (p) => {
          const k = p < 0.4 ? Easing.outQuad(p / 0.4) : 1 - Easing.outQuad((p - 0.4) / 0.6);
          cell.container.position.set(cell.baseX + nudgeX * k, cell.baseY + nudgeY * k);
        })
        .then(() => cell.container.position.set(cell.baseX, cell.baseY));
    }
  }

  function cellCenter(x: number, y: number): [number, number] {
    return [x * (CELL + GAP) + CELL / 2, y * (CELL + GAP) + CELL / 2];
  }

  function spawnBurstParticles(targets: readonly { x: number; y: number; symbol: SymbolType }[]) {
    for (const { x, y, symbol } of targets) {
      const color = SYMBOL_COLORS[symbol];
      const [cx, cy] = cellCenter(x, y);
      const count = 7;
      for (let i = 0; i < count; i += 1) {
        // Alternate soft bloom and crisp sparkle glints for a richer burst texture.
        const useSparkle = i % 2 === 0;
        const sprite = new Sprite(getWildwoodTexture(useSparkle ? WILDWOOD_TEXTURE_KEYS.sparkle : WILDWOOD_TEXTURE_KEYS.glow));
        sprite.anchor.set(0.5);
        sprite.tint = color;
        sprite.blendMode = "add";
        sprite.width = useSparkle ? 20 : 24;
        sprite.height = useSparkle ? 20 : 24;
        sprite.position.set(cx, cy);
        fxLayer.addChild(sprite);
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 32 + Math.random() * 22;
        const tx = cx + Math.cos(angle) * dist;
        const ty = cy + Math.sin(angle) * dist;
        runner
          .animate(
            560,
            (p) => {
              sprite.position.set(cx + (tx - cx) * p, cy + (ty - cy) * p);
              sprite.alpha = 1 - p;
              sprite.scale.set(1 - p * 0.4);
            },
            Easing.outCubic
          )
          .then(() => sprite.destroy());
      }
    }
  }

  /** Expanding tinted energy ring — the shared "something happened here" burst for both collects and materializing symbols. */
  function spawnRingPulse(x: number, y: number, color: number, opts: { size?: number; duration?: number; alpha?: number } = {}) {
    const [cx, cy] = cellCenter(x, y);
    const sprite = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.ringPulse));
    sprite.anchor.set(0.5);
    sprite.tint = color;
    sprite.blendMode = "add";
    sprite.position.set(cx, cy);
    fxLayer.addChild(sprite);

    const startSize = (opts.size ?? CELL * 1.2) * 0.35;
    const endSize = opts.size ?? CELL * 1.2;
    const duration = opts.duration ?? 500;
    const peakAlpha = opts.alpha ?? 0.85;
    sprite.width = startSize;
    sprite.height = startSize;
    sprite.alpha = 0;

    runner
      .animate(duration, (p) => {
        const size = startSize + (endSize - startSize) * Easing.outCubic(p);
        sprite.width = size;
        sprite.height = size;
        sprite.alpha = p < 0.2 ? (p / 0.2) * peakAlpha : peakAlpha * (1 - (p - 0.2) / 0.8);
      })
      .then(() => sprite.destroy());
  }

  /** `amount` is actual credits (already stake-multiplied) — never a raw paytable multiplier. */
  function spawnWinText(amount: number) {
    if (amount <= 0) return;
    const style = new TextStyle({
      fill: 0xfef3c7,
      fontSize: 30,
      fontWeight: "900",
      fontFamily: "system-ui, -apple-system, sans-serif",
      stroke: { color: 0x1c1206, width: 5 }
    });
    const text = new Text({ text: `+${amount.toFixed(2)}`, style });
    text.anchor.set(0.5);
    text.position.set(BOARD_W / 2, BOARD_H / 2);
    text.alpha = 0;
    fxLayer.addChild(text);
    runner
      .animate(1000, (p) => {
        text.alpha = p < 0.15 ? p / 0.15 : p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
        text.position.y = BOARD_H / 2 - p * 74;
      })
      .then(() => text.destroy());
  }

  async function playCollect(step: WildwoodStep, prevBoard: BoardCell[], gen: number, comboStreak: number, stake: number) {
    const collected = step.collected ?? [];
    if (collected.length === 0) return;
    const collectedSet = new Set(collected.map((c) => coordKey(c.x, c.y)));
    const links = findCollectionLinks(prevBoard, collectedSet);
    const beams = drawBeamsFromLinks(links);
    lungeCollectors(links);
    spawnBurstParticles(collected.map(({ x, y }) => ({ x, y, symbol: prevBoard[y * COLS + x].symbol })));
    if (step.winDelta) spawnWinText(step.winDelta * stake);
    wildwoodSound.playCollect(comboStreak);

    // Energy ring on every target being taken, plus a matching power-up pulse
    // on whichever collector(s) are doing the taking.
    for (const { x, y } of collected) {
      spawnRingPulse(x, y, SYMBOL_COLORS[prevBoard[y * COLS + x].symbol], { size: CELL * 1.3, duration: 480, alpha: 0.8 });
    }
    const collectorCoords = new Map<string, { x: number; y: number; symbol: SymbolType }>();
    for (const link of links) {
      const key = coordKey(link.sx, link.sy);
      if (!collectorCoords.has(key)) collectorCoords.set(key, { x: link.sx, y: link.sy, symbol: prevBoard[link.sy * COLS + link.sx].symbol });
    }
    for (const { x, y, symbol } of collectorCoords.values()) {
      spawnRingPulse(x, y, SYMBOL_COLORS[symbol], { size: CELL * 1.05, duration: 420, alpha: 0.6 });
    }

    const jobs = collected.map(({ x, y }) => {
      const cell = cellAt(x, y);
      const color = SYMBOL_COLORS[prevBoard[y * COLS + x].symbol];
      return runner.animate(400, (p) => {
        const bounce = p < 0.5 ? p / 0.5 : 1 - (p - 0.5) / 0.5;
        cell.container.scale.set(1 + Easing.outBack(bounce) * 0.22);
        cell.flash.clear();
        const glowAlpha = p < 0.15 ? p / 0.15 : 1 - Easing.inQuad((p - 0.15) / 0.85);
        if (glowAlpha > 0) {
          cell.flash.circle(CELL / 2, CELL / 2, CELL * 0.56).fill({ color, alpha: glowAlpha * 0.35 });
          cell.flash.circle(CELL / 2, CELL / 2, CELL * 0.42).stroke({ width: 4, color: 0xffffff, alpha: glowAlpha * 0.7 });
          cell.flash.circle(CELL / 2, CELL / 2, CELL * 0.42).stroke({ width: 8, color, alpha: glowAlpha * 0.4 });
        }
      });
    });
    await Promise.all(jobs);
    if (gen !== currentGeneration) return;
    await runner.animate(240, (p) => {
      beams.alpha = 1 - p;
    });
    beams.destroy();
    for (const { x, y } of collected) cellAt(x, y).container.scale.set(1);
  }

  /**
   * A symbol changing isn't just a resize — it flicks away, flashes, and the
   * new icon materializes under a light sweep with a burst of sparks and a
   * expanding color ring, like it was actually transformed rather than resized.
   */
  async function materializeCell(cell: CellView, symbol: SymbolType, gen: number) {
    await runner.animate(120, (p) => {
      const scale = 1 - Easing.inQuad(p);
      cell.symbolSprite.scale.set(scale);
      cell.shadowSprite.scale.set(scale);
    });
    if (gen !== currentGeneration) return;

    applyCellSymbol(cell, symbol);
    cell.symbolSprite.scale.set(0);
    cell.shadowSprite.scale.set(0);
    cell.symbolSprite.tint = 0xfff6d8;

    spawnBurstParticles([{ x: cell.x, y: cell.y, symbol }]);
    spawnRingPulse(cell.x, cell.y, SYMBOL_COLORS[symbol], { size: CELL * 1.15, duration: 380, alpha: 0.55 });

    const shine = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.shineSweep));
    shine.anchor.set(0.5);
    shine.width = CELL * 1.6;
    shine.height = CELL * 1.6;
    shine.blendMode = "add";
    shine.mask = cell.symbolSprite;
    shine.position.set(CELL / 2 - CELL, CELL / 2);
    cell.container.addChild(shine);

    await Promise.all([
      runner.animate(240, (p) => {
        const scale = Easing.outBack(p);
        cell.symbolSprite.scale.set(scale);
        cell.shadowSprite.scale.set(scale);
        cell.symbolSprite.tint = lerpColor(0xfff6d8, 0xffffff, p * 1.6);
      }),
      runner.animate(320, (p) => {
        shine.position.x = CELL / 2 - CELL + CELL * 2 * Easing.outCubic(p);
        shine.alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      })
    ]);
    cell.symbolSprite.tint = 0xffffff;
    shine.mask = null;
    shine.destroy();
  }

  async function playRefill(step: WildwoodStep, gen: number) {
    const changes = step.changes ?? [];
    if (changes.length === 0) return;
    wildwoodSound.playCascade();
    const jobs = changes.map(({ x, y, symbol }) => {
      const cell = cellAt(x, y);
      const delay = (x + y) * 22 + Math.random() * 40;
      return (async () => {
        await runner.wait(delay);
        if (gen !== currentGeneration) return;
        await materializeCell(cell, symbol, gen);
      })();
    });
    await Promise.all(jobs);
  }

  async function playBonusFlash(gen: number) {
    const flash = new Graphics().rect(0, 0, BOARD_W, BOARD_H).fill({ color: 0xfff3d6 });
    flash.alpha = 0;
    fxLayer.addChild(flash);
    setBonusTiles(true);
    await runner.animate(320, (p) => {
      flash.alpha = p < 0.35 ? p / 0.35 : 1 - (p - 0.35) / 0.65;
    });
    if (gen !== currentGeneration) return;
    flash.destroy();
  }

  async function playBanner(label: string, tone: "gold" | "emerald", holdMs: number, gen: number) {
    const banner = new Container();
    const text = new Text({
      text: label,
      style: new TextStyle({
        fill: tone === "gold" ? 0xffe9a8 : 0xd1fae5,
        fontSize: 25,
        fontWeight: "900",
        fontFamily: "system-ui, -apple-system, sans-serif",
        letterSpacing: 1
      })
    });
    text.anchor.set(0.5);
    // Sized to the text (win banners can carry a cash amount, e.g. "BIG WIN! +22.99") rather than a fixed pill.
    const pillWidth = Math.max(300, text.width + 70);
    const bg = new Graphics()
      .roundRect(-pillWidth / 2, -36, pillWidth, 72, 22)
      .fill({ color: 0x0b1f14, alpha: 0.85 })
      .stroke({ width: 2, color: tone === "gold" ? 0xf5c542 : 0x6ee7b7, alpha: 0.65 });
    banner.addChild(bg, text);
    banner.position.set(BOARD_W / 2, BOARD_H / 2);
    banner.scale.set(0.4);
    banner.alpha = 0;
    fxLayer.addChild(banner);
    await runner.animate(260, (p) => {
      banner.alpha = Math.min(1, p * 2);
      banner.scale.set(0.4 + Easing.outBack(p) * 0.6);
    });
    await runner.wait(holdMs);
    if (gen !== currentGeneration) return;
    await runner.animate(220, (p) => {
      banner.alpha = 1 - p;
      banner.scale.set(1 + p * 0.15);
    });
    banner.destroy();
  }

  function setStatus(message: string) {
    statusText.text = message;
  }

  /** One-time "so close" beat when the board is a single Spirit Seed away from the bonus. */
  async function playSeedAnticipation(board: BoardCell[], gen: number) {
    wildwoodSound.playSeedHint();
    seedTracker.pulse();
    const seedCells = board.filter((cell) => cell.symbol === "spiritSeed");
    const jobs = seedCells.map(({ x, y }) => {
      const cell = cellAt(x, y);
      return runner.animate(520, (p) => {
        cell.container.scale.set(1 + Math.sin(p * Math.PI) * 0.2);
      });
    });
    await Promise.all(jobs);
    if (gen !== currentGeneration) return;
  }

  /** The server already states breath progress in the message text ("Breath 2: ... 1 breaths remain") — read it back rather than re-deriving it. */
  function parseBreathInfo(message: string): { n: number; remain: number } | null {
    const match = /^Breath (\d+):.*?(\d+) breaths? remain/.exec(message);
    return match ? { n: Number(match[1]), remain: Number(match[2]) } : null;
  }

  function spawnCelebration(tier: "big" | "max") {
    celebrationField.setMode("celebrate");
    shakeScreen(tier === "max" ? 11 : 6, tier === "max" ? 520 : 340);
    void runner.wait(tier === "max" ? 1800 : 1300).then(() => celebrationField.setMode("off"));
  }

  let currentGeneration = 0;
  let activeRound: WildwoodRoundResult | null = null;

  async function playRound(
    round: WildwoodRoundResult,
    onStepChange?: (index: number, step: WildwoodStep, total: number) => void,
    onComplete?: (round: WildwoodRoundResult) => void
  ) {
    const myGeneration = ++currentGeneration;
    activeRound = round;
    const frames = buildFrames(round);
    const stake = round.stake;
    let multiplier = 1;
    let comboStreak = 0;
    let cascadeCount = 0;
    let potCash = 0;
    let seedsSeenSoFar = round.initialBoard.filter((cell) => cell.symbol === "spiritSeed").length;
    let seedHintShown = false;

    runner.cancelAll();
    clearFx();
    setBonusTiles(false);
    multiplierBadge.hide();
    potBadge.hide();
    seedTracker.hide();
    for (const cell of cells) cell.container.alpha = 0;

    for (let i = 0; i < round.steps.length; i += 1) {
      if (myGeneration !== currentGeneration) return;
      const step = round.steps[i];
      const prev = i === 0 ? round.initialBoard : frames[i - 1];
      setStatus(step.message);

      switch (step.type) {
        case "boardGenerated":
          await playIntro(prev, myGeneration);
          if (myGeneration !== currentGeneration) return;
          potBadge.setAmount(0);
          potBadge.setSub(`Cascade 0/${WILDWOOD_CONFIG.maxBaseCascades}`, "emerald");
          potBadge.show();
          seedTracker.setProgress(Math.min(seedsSeenSoFar, WILDWOOD_CONFIG.bonusTriggerSeeds));
          seedTracker.show();
          break;
        case "symbolsCollected":
          await playCollect(step, prev, myGeneration, comboStreak, stake);
          comboStreak += 1;
          cascadeCount += 1;
          if (myGeneration !== currentGeneration) return;
          potCash += (step.winDelta ?? 0) * stake;
          potBadge.setAmount(potCash);
          potBadge.setSub(`Cascade ${cascadeCount}/${WILDWOOD_CONFIG.maxBaseCascades}`, "emerald");
          break;
        case "cascade":
          await playRefill(step, myGeneration);
          break;
        case "bonusTriggered":
          wildwoodSound.playBonusTrigger();
          await playBonusFlash(myGeneration);
          if (myGeneration !== currentGeneration) return;
          seedTracker.hide();
          multiplierBadge.show();
          multiplier = 1;
          multiplierBadge.set(multiplier);
          potBadge.setSub("Bonus!", "gold");
          await playBanner("WILDWOOD BONUS", "gold", 700, myGeneration);
          break;
        case "bonusBreath": {
          if (step.collected?.length) {
            const seedsTaken = step.collected.filter(({ x, y }) => prev[y * COLS + x].symbol === "spiritSeed").length;
            await playCollect(step, prev, myGeneration, comboStreak, stake);
            comboStreak += 1;
            if (myGeneration !== currentGeneration) return;
            potCash += (step.winDelta ?? 0) * stake;
            potBadge.setAmount(potCash);
            if (seedsTaken > 0) {
              multiplier += seedsTaken;
              multiplierBadge.set(multiplier);
              wildwoodSound.playMultiplierUp();
            }
          }
          await playRefill(step, myGeneration);
          if (myGeneration !== currentGeneration) return;
          const breathInfo = parseBreathInfo(step.message);
          if (breathInfo) potBadge.setSub(`Breath ${breathInfo.n} · ${breathInfo.remain} left`, "gold");
          break;
        }
        case "bonusEnded":
          wildwoodSound.playBonusEnd();
          await playBanner(step.message, "gold", 750, myGeneration);
          if (myGeneration !== currentGeneration) return;
          multiplierBadge.hide();
          potBadge.setSub("Bonus complete", "gold");
          break;
        case "roundEnded": {
          // Snap to the authoritative server total — the running pot can't see the 1000x cap coming.
          potCash = round.cappedWin;
          potBadge.setAmount(potCash);
          potBadge.setSub("Round complete", round.cappedWin > 0 ? "gold" : "emerald");
          const perStake = stake > 0 ? round.cappedWin / stake : 0;
          const isMax = round.capApplied;
          const isBig = !isMax && perStake >= 20;
          const label = isMax ? "MAX WIN!" : isBig ? "BIG WIN!" : "ROUND COMPLETE";
          const cashLabel = round.cappedWin > 0 ? `${label} +${round.cappedWin.toFixed(2)}` : label;
          if (isMax || isBig) {
            wildwoodSound[isMax ? "playMaxWin" : "playBigWin"]();
            spawnCelebration(isMax ? "max" : "big");
          }
          await playBanner(cashLabel, round.cappedWin > 0 ? "gold" : "emerald", 900, myGeneration);
          break;
        }
        default:
          break;
      }

      if (myGeneration !== currentGeneration) return;

      // Base-game-only anticipation beat: one Spirit Seed short of triggering the bonus.
      if (step.type === "cascade" || step.type === "boardGenerated") {
        const newSeeds = step.type === "cascade" ? (step.changes ?? []).filter((c) => c.symbol === "spiritSeed").length : 0;
        seedsSeenSoFar += newSeeds;
        if (newSeeds > 0) seedTracker.setProgress(Math.min(seedsSeenSoFar, WILDWOOD_CONFIG.bonusTriggerSeeds));
        if (!seedHintShown && seedsSeenSoFar === WILDWOOD_CONFIG.bonusTriggerSeeds - 1) {
          seedHintShown = true;
          await playSeedAnticipation(frames[i] ?? round.initialBoard, myGeneration);
          if (myGeneration !== currentGeneration) return;
        }
      }

      onStepChange?.(i, step, round.steps.length);
      await runner.wait(pacingDelay(step));
    }

    if (myGeneration !== currentGeneration) return;
    onComplete?.(round);
  }

  function seek(index: number) {
    if (!activeRound) return;
    currentGeneration += 1;
    runner.cancelAll();
    const frames = buildFrames(activeRound);
    const clamped = Math.max(0, Math.min(index, frames.length - 1));
    const board = frames[clamped];
    const stake = activeRound.stake;
    clearFx();

    let bonusActive = false;
    let multiplier = 1;
    let cascadeCount = 0;
    let potCash = 0;
    let seedsSeenSoFar = activeRound.initialBoard.filter((cell) => cell.symbol === "spiritSeed").length;
    let breathInfo: { n: number; remain: number } | null = null;
    for (let i = 0; i <= clamped; i += 1) {
      const step = activeRound.steps[i];
      if (step.type === "symbolsCollected") {
        if (!bonusActive) cascadeCount += 1;
        potCash += (step.winDelta ?? 0) * stake;
      }
      if (step.type === "cascade") {
        seedsSeenSoFar += (step.changes ?? []).filter((c) => c.symbol === "spiritSeed").length;
      }
      if (step.type === "bonusTriggered") {
        bonusActive = true;
        multiplier = 1;
      }
      if (step.type === "bonusEnded") bonusActive = false;
      if (step.type === "bonusBreath") {
        if (step.collected?.length) {
          const prev = i === 0 ? activeRound.initialBoard : frames[i - 1];
          const seedsTaken = step.collected.filter(({ x, y }) => prev[y * COLS + x].symbol === "spiritSeed").length;
          multiplier += seedsTaken;
          potCash += (step.winDelta ?? 0) * stake;
        }
        breathInfo = parseBreathInfo(step.message) ?? breathInfo;
      }
      if (step.type === "roundEnded") potCash = activeRound.cappedWin;
    }

    setBonusTiles(bonusActive);
    const currentType = activeRound.steps[clamped]?.type;
    if (bonusActive) {
      multiplierBadge.show();
      multiplierBadge.set(multiplier);
      potBadge.setSub(breathInfo ? `Breath ${breathInfo.n} · ${breathInfo.remain} left` : "Bonus!", "gold");
    } else {
      multiplierBadge.hide();
      if (currentType === "roundEnded") {
        potBadge.setSub("Round complete", activeRound.cappedWin > 0 ? "gold" : "emerald");
      } else {
        potBadge.setSub(`Cascade ${cascadeCount}/${WILDWOOD_CONFIG.maxBaseCascades}`, "emerald");
      }
    }
    if (currentType) {
      potBadge.setAmount(potCash);
      potBadge.show();
    } else {
      potBadge.hide();
    }
    seedTracker.setProgress(Math.min(seedsSeenSoFar, WILDWOOD_CONFIG.bonusTriggerSeeds));
    seedTracker.container.visible = !bonusActive && currentType !== "roundEnded" && currentType !== undefined;
    setBoardInstant(board);
    setStatus(activeRound.steps[clamped]?.message ?? "");
    celebrationField.setMode("off");
  }

  function skipToEnd() {
    if (!activeRound) return;
    seek(activeRound.steps.length - 1);
  }

  function resize() {
    const w = app.screen.width;
    const h = app.screen.height;
    if (w === 0 || h === 0) return;
    const scale = Math.min(w / DESIGN_W, h / DESIGN_H);
    root.scale.set(scale);
    root.position.set((w - DESIGN_W * scale) / 2, (h - DESIGN_H * scale) / 2);
  }

  function destroy() {
    app.ticker.remove(pulseTicker);
    app.ticker.remove(driftTicker);
    ambientField.destroy();
    celebrationField.destroy();
    runner.destroy();
  }

  // Idle scene until the first round resolves.
  setBonusTiles(false);
  ambientField.setMode("idle");
  for (const cell of cells) cell.container.alpha = 0;

  return { resize, playRound, seek, skipToEnd, destroy };
}

/** A soft glass-dome rim light over every icon — bright top-left, dark bottom-right — for a uniform "polished token" finish regardless of the symbol's own art. */
function drawTileBevel(g: Graphics) {
  const cx = CELL / 2;
  const cy = CELL / 2;
  const r = CELL * 0.41;
  g.clear();
  g.arc(cx, cy, r, Math.PI * 1.05, Math.PI * 1.85).stroke({ width: 3, color: 0xffffff, alpha: 0.32, cap: "round" });
  g.arc(cx, cy, r, Math.PI * 0.05, Math.PI * 0.85).stroke({ width: 3, color: 0x000000, alpha: 0.24, cap: "round" });
}

/** Carved-wood double-bevel border with a soft outer glow and faceted gem studs, framing the grid. */
function drawBoardFrame(g: Graphics) {
  const pad = 14;
  const x = -pad;
  const y = -pad;
  const w = BOARD_W + pad * 2;
  const h = BOARD_H + pad * 2;
  g.clear();

  // Soft glow halo, built from fading concentric strokes (Graphics has no blur filter).
  for (let i = 3; i >= 1; i -= 1) {
    g.roundRect(x - i * 2, y - i * 2, w + i * 4, h + i * 4, 26 + i * 2).stroke({ width: 3, color: 0xf5c542, alpha: 0.05 * i });
  }

  g.roundRect(x, y, w, h, 26).stroke({ width: 10, color: 0x1c130a, alpha: 0.9 });
  g.roundRect(x + 6, y + 6, w - 12, h - 12, 22).stroke({ width: 3, color: 0xf0c876, alpha: 0.4 });
  g.roundRect(x + 3, y + 3, w - 6, h - 6, 24).stroke({ width: 1.2, color: 0xffe9a8, alpha: 0.25 });

  const gemAt = (cx: number, cy: number, size: number) => {
    g.poly([cx, cy - size, cx + size, cy, cx, cy + size, cx - size, cy])
      .fill({ color: 0xfff3d0, alpha: 0.95 })
      .stroke({ width: 1.2, color: 0x8a5a12, alpha: 0.8 });
    g.poly([cx, cy - size * 0.4, cx + size * 0.35, cy, cx, cy + size * 0.4, cx - size * 0.35, cy]).fill({ color: 0xffffff, alpha: 0.55 });
  };

  gemAt(x + 15, y + 15, 5.5);
  gemAt(x + w - 15, y + 15, 5.5);
  gemAt(x + 15, y + h - 15, 5.5);
  gemAt(x + w - 15, y + h - 15, 5.5);
  gemAt(x + w / 2, y - 2, 6.5);
}

function buildCellView(x: number, y: number): CellView {
  const baseX = x * (CELL + GAP);
  const baseY = y * (CELL + GAP);
  const container = new Container();
  container.position.set(baseX, baseY);

  const tileSprite = new Sprite(getWildwoodTexture(WILDWOOD_TEXTURE_KEYS.tile));
  tileSprite.width = CELL;
  tileSprite.height = CELL;
  container.addChild(tileSprite);

  const glow = new Graphics();
  container.addChild(glow);

  const shadowSprite = new Sprite();
  shadowSprite.anchor.set(0.5);
  shadowSprite.tint = 0x000000;
  shadowSprite.alpha = 0.32;
  shadowSprite.position.set(CELL / 2 + 3, CELL / 2 + 6);
  container.addChild(shadowSprite);

  const symbolSprite = new Sprite();
  symbolSprite.anchor.set(0.5);
  symbolSprite.position.set(CELL / 2, CELL / 2);
  container.addChild(symbolSprite);

  // Consistent "glass dome" rim-light over every icon — a token-bevel layer
  // applied uniformly in Pixi rather than baked per-symbol into 11 SVGs.
  const bevel = new Graphics();
  drawTileBevel(bevel);
  container.addChild(bevel);

  const flash = new Graphics();
  container.addChild(flash);

  const valueBg = new Graphics();
  container.addChild(valueBg);

  const valueLabel = new Text({
    text: "",
    style: new TextStyle({
      fill: 0xffffff,
      fontSize: 13,
      fontWeight: "800",
      fontFamily: "system-ui, -apple-system, sans-serif"
    })
  });
  valueLabel.anchor.set(0.5);
  valueLabel.position.set(CELL / 2, CELL - 13);
  container.addChild(valueLabel);

  const targetsBg = new Graphics();
  container.addChild(targetsBg);

  const targetIcons: Sprite[] = [];
  for (let i = 0; i < 3; i += 1) {
    const icon = new Sprite();
    icon.anchor.set(0.5);
    icon.visible = false;
    container.addChild(icon);
    targetIcons.push(icon);
  }

  const targetsAnyLabel = new Text({
    text: "ANY",
    style: new TextStyle({
      fill: 0xffe9a8,
      fontSize: 10,
      fontWeight: "900",
      fontFamily: "system-ui, -apple-system, sans-serif",
      letterSpacing: 1
    })
  });
  targetsAnyLabel.anchor.set(0.5);
  targetsAnyLabel.position.set(CELL / 2, 17);
  targetsAnyLabel.visible = false;
  container.addChild(targetsAnyLabel);

  return {
    x,
    y,
    baseX,
    baseY,
    symbol: null,
    container,
    tileSprite,
    glow,
    shadowSprite,
    symbolSprite,
    bevel,
    flash,
    valueBg,
    valueLabel,
    targetsBg,
    targetIcons,
    targetsAnyLabel
  };
}

function buildMultiplierBadge() {
  const container = new Container();
  const bg = new Graphics().roundRect(-46, -18, 92, 36, 14).fill({ color: 0x1c1206, alpha: 0.85 }).stroke({ width: 2, color: 0xf5c542, alpha: 0.7 });
  const text = new Text({
    text: "x1",
    style: new TextStyle({ fill: 0xffe9a8, fontSize: 20, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif" })
  });
  text.anchor.set(1, 0.5);
  text.position.set(30, 0);
  const star = new Text({ text: "✦", style: new TextStyle({ fill: 0xf5c542, fontSize: 16 }) });
  star.anchor.set(0, 0.5);
  star.position.set(-40, 0);
  container.addChild(bg, star, text);
  container.pivot.set(46, 0);
  container.visible = false;

  return {
    container,
    show() {
      container.visible = true;
    },
    hide() {
      container.visible = false;
    },
    set(value: number) {
      text.text = `x${value}`;
      container.scale.set(1.3);
      const start = performance.now();
      const bump = () => {
        const p = Math.min(1, (performance.now() - start) / 220);
        container.scale.set(1.3 - 0.3 * Easing.outQuad(p));
        if (p < 1) requestAnimationFrame(bump);
      };
      requestAnimationFrame(bump);
    }
  };
}

/**
 * Running cash pot for the round, with a small subtitle underneath for
 * whatever global budget is currently in play — cascades left in the base
 * game, or bonus breaths remaining. Always shows credits, never a raw
 * paytable multiplier.
 */
function buildPotBadge() {
  const container = new Container();
  const bg = new Graphics();
  container.addChild(bg);

  const amountText = new Text({
    text: "🪙 0.00",
    style: new TextStyle({ fill: 0xffe9a8, fontSize: 19, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif" })
  });
  amountText.anchor.set(0.5, 0);
  amountText.position.set(0, -22);
  container.addChild(amountText);

  const subText = new Text({
    text: "",
    style: new TextStyle({ fill: 0xbfe8d6, fontSize: 12, fontWeight: "700", fontFamily: "system-ui, -apple-system, sans-serif" })
  });
  subText.anchor.set(0.5, 0);
  subText.position.set(0, 3);
  container.addChild(subText);

  container.visible = false;

  function redrawBg(tone: "gold" | "emerald") {
    bg.clear()
      .roundRect(-66, -27, 132, 50, 16)
      .fill({ color: 0x0b1f14, alpha: 0.88 })
      .stroke({ width: 2, color: tone === "gold" ? 0xf5c542 : 0x6ee7b7, alpha: 0.55 });
  }
  redrawBg("emerald");

  return {
    container,
    show() {
      container.visible = true;
    },
    hide() {
      container.visible = false;
    },
    setSub(label: string, tone: "gold" | "emerald" = "emerald") {
      subText.text = label;
      redrawBg(tone);
    },
    setAmount(cash: number) {
      amountText.text = `🪙 ${cash.toFixed(2)}`;
      amountText.scale.set(1.18);
      const start = performance.now();
      const bump = () => {
        const p = Math.min(1, (performance.now() - start) / 220);
        amountText.scale.set(1.18 - 0.18 * Easing.outQuad(p));
        if (p < 1) requestAnimationFrame(bump);
      };
      requestAnimationFrame(bump);
    }
  };
}

/**
 * Persistent "N of 3 Spirit Seeds seen" tracker — dim pips light up and glow
 * as seeds actually land, instead of a one-shot hint the player might miss.
 */
function buildSeedTracker(total: number) {
  const container = new Container();
  const spacing = 26;
  const startX = (-(total - 1) * spacing) / 2;
  const pips: Array<{ icon: Sprite; glow: Graphics; x: number }> = [];

  for (let i = 0; i < total; i += 1) {
    const x = startX + i * spacing;
    const glow = new Graphics();
    glow.position.set(x, 0);
    container.addChild(glow);
    const icon = new Sprite(getSymbolTexture("spiritSeed"));
    icon.anchor.set(0.5);
    icon.width = 20;
    icon.height = 20;
    icon.position.set(x, 0);
    container.addChild(icon);
    pips.push({ icon, glow, x });
  }
  container.visible = false;

  return {
    container,
    show() {
      container.visible = true;
    },
    hide() {
      container.visible = false;
    },
    setProgress(count: number) {
      pips.forEach((pip, i) => {
        const lit = i < count;
        pip.icon.alpha = lit ? 1 : 0.3;
        pip.icon.tint = lit ? 0xffffff : 0x555555;
        pip.glow.clear();
        if (lit) pip.glow.circle(0, 0, 14).fill({ color: 0x67e8f9, alpha: 0.4 });
      });
    },
    pulse() {
      container.scale.set(1.35);
      const start = performance.now();
      const bump = () => {
        const p = Math.min(1, (performance.now() - start) / 260);
        container.scale.set(1.35 - 0.35 * Easing.outBack(p));
        if (p < 1) requestAnimationFrame(bump);
      };
      requestAnimationFrame(bump);
    }
  };
}

type ParticleMode = "idle" | "bonus" | "celebrate" | "off";

const CELEBRATION_PALETTE = [0xf5c542, 0x34d399, 0xf472b6, 0x67e8f9, 0xffffff];

class ParticleField {
  readonly container = new Container();
  private readonly particles: Array<{ sprite: Sprite; vx: number; vy: number; life: number; maxLife: number }> = [];
  private mode: ParticleMode = "off";
  private spawnTimer = 0;

  constructor(
    private readonly ticker: Ticker,
    private readonly texture: Texture,
    private readonly w: number,
    private readonly h: number
  ) {
    this.ticker.add(this.update);
  }

  setMode(mode: ParticleMode) {
    this.mode = mode;
  }

  private readonly update = () => {
    if (this.mode !== "off") {
      this.spawnTimer -= this.ticker.deltaMS;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.mode === "celebrate" ? 26 : this.mode === "bonus" ? 200 : 520;
        this.spawn();
      }
    }
    const step = this.ticker.deltaMS / 16.67;
    for (const p of [...this.particles]) {
      p.life += this.ticker.deltaMS;
      const t = p.life / p.maxLife;
      p.sprite.position.x += p.vx * step;
      p.sprite.position.y += p.vy * step;
      p.sprite.alpha = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1;
      if (t >= 1) {
        this.particles.splice(this.particles.indexOf(p), 1);
        p.sprite.destroy();
      }
    }
  };

  private pickColor(): number {
    if (this.mode === "celebrate") return CELEBRATION_PALETTE[Math.floor(Math.random() * CELEBRATION_PALETTE.length)];
    return this.mode === "bonus" ? 0xf5c542 : 0x8ef7c9;
  }

  private spawn() {
    const sprite = new Sprite(this.texture);
    sprite.anchor.set(0.5);
    sprite.blendMode = "add";
    const isCelebrate = this.mode === "celebrate";
    const size = isCelebrate ? 10 + Math.random() * 14 : 6 + Math.random() * 10;
    sprite.width = size;
    sprite.height = size;
    sprite.tint = this.pickColor();
    sprite.alpha = 0;
    sprite.position.set(Math.random() * this.w, this.h + 10);
    this.container.addChild(sprite);
    this.particles.push({
      sprite,
      vx: (Math.random() - 0.5) * (isCelebrate ? 1.5 : 0.4),
      vy: -(isCelebrate ? 1.7 + Math.random() * 1.7 : 0.5 + Math.random() * 0.8),
      life: 0,
      maxLife: isCelebrate ? 1300 + Math.random() * 700 : 4000 + Math.random() * 2000
    });
  }

  destroy() {
    this.ticker.remove(this.update);
    for (const p of this.particles) p.sprite.destroy();
    this.particles.length = 0;
    this.container.destroy({ children: true });
  }
}
