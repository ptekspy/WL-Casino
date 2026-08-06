"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite, Text, TextStyle, type Ticker } from "pixi.js";
import type { BoardCell, CollectorType, DragonforgeRoundResult, DragonforgeStep, SymbolType } from "@/lib/dragonforge";
import { DRAGONFORGE_CONFIG, buildFrames, getCascadeValueMultiplier, getDragonState, getScaledCollectableValue } from "@/lib/dragonforge";
import { loadDragonforgeAssets, getDragonforgeSymbolTexture } from "@/lib/pixi/dragonforge-assets";
import { Easing, TweenRunner } from "@/lib/pixi/tween";
import { dragonforgeSound } from "@/lib/pixi/sound";
import { getWinPresentation } from "@/lib/pixi/presentation";
import { formatCredits } from "@/lib/currency";

/**
 * Painted portraits (see src/lib/pixi/dragonforge-assets.ts), not real alpha
 * cutouts — the AI generator returned opaque squares with a painted vignette
 * background. Each symbol sprite gets masked to its shape (circle for
 * resources, hexagon for collectors, diamond for the Dragon Egg, jagged for
 * Unstable Rock) at render time instead, matching the crop convention
 * Wildwood's pre-cropped assets already read as.
 */

const { width: COLS, height: ROWS } = DRAGONFORGE_CONFIG;
const CELL = 100;
const GAP = 8;
const FRAME_PAD = 34;
const TOP_BAR = 104;
const BOARD_W = COLS * CELL + (COLS - 1) * GAP;
const BOARD_H = ROWS * CELL + (ROWS - 1) * GAP;
const DESIGN_W = BOARD_W + FRAME_PAD * 2;
const DESIGN_H = BOARD_H + FRAME_PAD * 2 + TOP_BAR;
export const DRAGONFORGE_BOARD_ASPECT = `${DESIGN_W} / ${DESIGN_H}`;
export const DRAGONFORGE_BOARD_DESIGN_WIDTH = DESIGN_W;
export const DRAGONFORGE_BOARD_DESIGN_HEIGHT = DESIGN_H;

const SYMBOL_COLORS: Record<SymbolType, number> = {
  stone: 0x9aa0a8,
  iron: 0xc08a5c,
  gold: 0xf5c542,
  gem: 0x22d3ee,
  relic: 0xc084fc,
  unstableRock: 0xc2410c,
  dragonEgg: 0x2dd4bf,
  miner: 0xf59e0b,
  prospector: 0x38bdf8,
  smith: 0xef4444,
  scout: 0xa78bfa
};

function isCollectorSymbol(symbol: SymbolType): symbol is CollectorType {
  return symbol === "miner" || symbol === "prospector" || symbol === "smith" || symbol === "scout";
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

function regularPolygonPoints(sides: number, radius: number, rotation = -Math.PI / 2): number[] {
  const points: number[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  return points;
}

function starPoints(spikes: number, outerRadius: number, innerRadius: number, rotation = -Math.PI / 2): number[] {
  const points: number[] = [];
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotation + (i / (spikes * 2)) * Math.PI * 2;
    points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  return points;
}

type SymbolShape = "circle" | "hexagon" | "diamond" | "jagged";

/** Matches the crop convention from the art prompt style bible: resource/collector/bonus/hazard read as distinct silhouettes. */
const SYMBOL_SHAPE: Record<SymbolType, SymbolShape> = {
  stone: "circle",
  iron: "circle",
  gold: "circle",
  gem: "circle",
  relic: "circle",
  unstableRock: "jagged",
  dragonEgg: "diamond",
  miner: "hexagon",
  prospector: "hexagon",
  smith: "hexagon",
  scout: "hexagon"
};

/** Draws a symbol's crop shape centered at (0,0) into `g`, for use as a sprite mask. */
function drawSymbolMask(g: Graphics, symbol: SymbolType, size: number) {
  g.clear();
  switch (SYMBOL_SHAPE[symbol]) {
    case "circle":
      g.circle(0, 0, size).fill(0xffffff);
      break;
    case "hexagon":
      g.poly(regularPolygonPoints(6, size)).fill(0xffffff);
      break;
    case "diamond":
      g.poly(regularPolygonPoints(4, size)).fill(0xffffff);
      break;
    case "jagged": {
      const jagged = [0, -size, size * 0.7, -size * 0.35, size * 0.95, size * 0.3, size * 0.25, size, -size * 0.55, size * 0.85, -size * 0.95, size * 0.1, -size * 0.65, -size * 0.5];
      g.poly(jagged).fill(0xffffff);
      break;
    }
  }
}

/** Thin bezel ring drawn over the masked sprite so the crop shape reads clearly against the tile. */
function drawSymbolBezel(g: Graphics, symbol: SymbolType, size: number) {
  g.clear();
  const color = SYMBOL_COLORS[symbol];
  switch (SYMBOL_SHAPE[symbol]) {
    case "circle":
      g.circle(0, 0, size).stroke({ width: 2.5, color, alpha: 0.75 });
      break;
    case "hexagon":
      g.poly(regularPolygonPoints(6, size)).stroke({ width: 2.5, color, alpha: 0.75 });
      break;
    case "diamond":
      g.poly(regularPolygonPoints(4, size)).stroke({ width: 2.5, color, alpha: 0.75 });
      break;
    case "jagged": {
      const jagged = [0, -size, size * 0.7, -size * 0.35, size * 0.95, size * 0.3, size * 0.25, size, -size * 0.55, size * 0.85, -size * 0.95, size * 0.1, -size * 0.65, -size * 0.5];
      g.poly(jagged).stroke({ width: 2, color, alpha: 0.6 });
      break;
    }
  }
}

type IdleMotion = { x: number; y: number; rotation: number; scale: number };

function getIdleMotion(symbol: SymbolType, time: number, phase: number): IdleMotion {
  const slow = Math.sin(time * 1.1 + phase);
  const medium = Math.sin(time * 1.7 + phase * 0.7);
  if (symbol === "unstableRock") return { x: 0, y: slow * 0.3, rotation: slow * 0.01, scale: 1 };
  if (symbol === "dragonEgg") return { x: slow * 0.7, y: medium * 1.8, rotation: slow * 0.02, scale: 1 + medium * 0.02 };
  if (isCollectorSymbol(symbol)) return { x: slow * 0.4, y: medium * 1, rotation: slow * 0.02, scale: 1 + medium * 0.02 };
  return { x: slow * 0.5, y: medium * 1, rotation: slow * 0.02, scale: 1 + medium * 0.015 };
}

export type DragonforgeBoardHandle = {
  seek: (stepIndex: number) => void;
  skipToEnd: () => void;
};

type DragonforgePixiBoardProps = {
  round: DragonforgeRoundResult | null;
  stake: number;
  onStepChange?: (stepIndex: number, step: DragonforgeStep, totalSteps: number) => void;
  onRoundComplete?: (round: DragonforgeRoundResult) => void;
};

export const DragonforgePixiBoard = forwardRef<DragonforgeBoardHandle, DragonforgePixiBoardProps>(function DragonforgePixiBoard(
  { round, stake, onStepChange, onRoundComplete },
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

      await loadDragonforgeAssets();
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

  useEffect(() => {
    if (!ready) return;
    worldRef.current?.setStake(stake);
  }, [ready, stake]);

  return <div ref={hostRef} className="relative h-full w-full overflow-hidden rounded-[1.75rem]" />;
});

type CellView = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  symbol: SymbolType | null;
  container: Container;
  tileBg: Graphics;
  glow: Graphics;
  symbolSprite: Sprite;
  symbolMask: Graphics;
  symbolBezel: Graphics;
  baseSymbolScale: number;
  valueBg: Graphics;
  valueLabel: Text;
  cascadeBadgeBg: Graphics;
  cascadeBadgeLabel: Text;
  motionLocked: boolean;
};

type BoardWorld = {
  resize: () => void;
  playRound: (
    round: DragonforgeRoundResult,
    onStepChange?: (index: number, step: DragonforgeStep, total: number) => void,
    onComplete?: (round: DragonforgeRoundResult) => void
  ) => void;
  seek: (index: number) => void;
  skipToEnd: () => void;
  setStake: (stake: number) => void;
  destroy: () => void;
};

function pacingDelay(step: DragonforgeStep): number {
  switch (step.type) {
    case "boardGenerated": return 260;
    case "symbolsCollected": return 140;
    case "cascade": return 280;
    case "hoardTriggered": return 140;
    case "delveBreath": return 220;
    case "hoardEnded": return 260;
    case "roundEnded": return 0;
    default: return 160;
  }
}

function buildWorld(app: Application): BoardWorld {
  const runner = new TweenRunner(app.ticker);

  const root = new Container();
  app.stage.addChild(root);

  const shakeContainer = new Container();
  root.addChild(shakeContainer);

  // Cave backdrop: flat dark rock fill plus a couple of soft warm glow pools
  // standing in for torch light, instead of loaded background textures.
  const bg = new Graphics().rect(0, 0, DESIGN_W, DESIGN_H).fill({ color: 0x120a08 });
  shakeContainer.addChild(bg);
  const glowPoolA = new Graphics().circle(DESIGN_W * 0.2, DESIGN_H * 0.25, 220).fill({ color: 0x5c2a0f, alpha: 0.28 });
  const glowPoolB = new Graphics().circle(DESIGN_W * 0.85, DESIGN_H * 0.8, 260).fill({ color: 0x0f3a36, alpha: 0.22 });
  shakeContainer.addChild(glowPoolA, glowPoolB);

  let presentationLevel = 0;
  let bonusPresentation = false;
  let driftPhase = 0;
  const driftTicker = (ticker: Ticker) => {
    driftPhase += ticker.deltaMS / 1000;
    glowPoolA.alpha = 0.24 + Math.sin(driftPhase * 0.3) * 0.05 + presentationLevel * 0.02;
    glowPoolB.alpha = (bonusPresentation ? 0.4 : 0.2) + Math.sin(driftPhase * 0.24 + 1) * 0.05 + presentationLevel * 0.02;
    glowPoolB.tint = bonusPresentation ? 0xf5c542 : 0xffffff;
  };
  app.ticker.add(driftTicker);

  const statusStyle = new TextStyle({
    fill: 0xffe6cf,
    fontSize: 17,
    fontWeight: "700",
    fontFamily: "system-ui, -apple-system, sans-serif",
    align: "center",
    wordWrap: true,
    wordWrapWidth: DESIGN_W - 2 * FRAME_PAD
  });
  const statusText = new Text({ text: "Press play to break into the mine.", style: statusStyle });
  statusText.anchor.set(0.5, 0);
  statusText.position.set(DESIGN_W / 2, 58);
  shakeContainer.addChild(statusText);

  const multiplierBadge = buildMultiplierBadge();
  multiplierBadge.container.position.set(DESIGN_W - 16, 16);
  shakeContainer.addChild(multiplierBadge.container);

  const potBadge = buildPotBadge();
  potBadge.container.position.set(18, 28);
  shakeContainer.addChild(potBadge.container);

  const eggTracker = buildEggTracker(DRAGONFORGE_CONFIG.bonusTriggerEggs);
  eggTracker.container.position.set(DESIGN_W / 2, 16);
  shakeContainer.addChild(eggTracker.container);

  const frameGraphics = new Graphics();
  frameGraphics.position.set(FRAME_PAD, TOP_BAR + FRAME_PAD);
  shakeContainer.addChild(frameGraphics);
  drawBoardFrame(frameGraphics, 0, false);

  const boardContainer = new Container();
  boardContainer.position.set(FRAME_PAD, TOP_BAR + FRAME_PAD);
  shakeContainer.addChild(boardContainer);

  const cells: CellView[] = [];
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const cell = buildCellView(x, y);
      boardContainer.addChild(cell.container);
      cells.push(cell);
    }
  }
  let collectableValueMultiplier = 1;
  let currentStake = 1;

  const focusShade = new Graphics().rect(0, 0, BOARD_W, BOARD_H).fill({ color: 0x030201, alpha: 1 });
  focusShade.alpha = 0;
  focusShade.eventMode = "none";
  boardContainer.addChild(focusShade);

  const fxLayer = new Container();
  boardContainer.addChild(fxLayer);

  let glowPulse = 0;
  const pulseTicker = (ticker: Ticker) => {
    glowPulse += ticker.deltaMS / 1000;
    for (const cell of cells) {
      if (cell.symbol && !cell.motionLocked) {
        const phase = cell.x * 1.7 + cell.y * 2.3;
        const motion = getIdleMotion(cell.symbol, glowPulse, phase);
        cell.symbolSprite.position.set(CELL / 2 + motion.x, CELL / 2 + motion.y);
        cell.symbolSprite.rotation = motion.rotation;
        cell.symbolSprite.scale.set(cell.baseSymbolScale * motion.scale);
      }
      if (cell.glow.alpha === 0 && !cell.symbol) continue;
      cell.glow.alpha = 0.5 + Math.sin(glowPulse * 2 + cell.x * 0.7 + cell.y * 0.5) * 0.3 + presentationLevel * 0.03;
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

  function cellCenter(x: number, y: number): [number, number] {
    return [x * (CELL + GAP) + CELL / 2, y * (CELL + GAP) + CELL / 2];
  }

  function restoreCellVisualState(cell: CellView) {
    cell.symbolSprite.visible = true;
    cell.symbolSprite.alpha = 1;
    cell.symbolSprite.tint = 0xffffff;
    cell.symbolBezel.visible = true;
    cell.glow.visible = true;
    cell.valueBg.visible = true;
    cell.valueLabel.visible = true;
    cell.cascadeBadgeLabel.visible = false;
  }

  function hideCellVisualState(cell: CellView) {
    cell.symbolSprite.visible = false;
    cell.symbolBezel.visible = false;
    cell.glow.visible = false;
    cell.valueBg.visible = false;
    cell.valueLabel.visible = false;
    cell.cascadeBadgeBg.clear();
    cell.cascadeBadgeLabel.visible = false;
  }

  function applyCellSymbol(cell: CellView, symbol: SymbolType) {
    restoreCellVisualState(cell);
    cell.symbol = symbol;
    cell.motionLocked = false;
    const size = isCollectorSymbol(symbol) ? CELL * 0.34 : symbol === "dragonEgg" ? CELL * 0.32 : CELL * 0.28;
    drawSymbolMask(cell.symbolMask, symbol, size);
    drawSymbolBezel(cell.symbolBezel, symbol, size);
    cell.symbolSprite.texture = getDragonforgeSymbolTexture(symbol);
    cell.symbolSprite.width = size * 2.3;
    cell.symbolSprite.height = size * 2.3;
    cell.symbolSprite.position.set(CELL / 2, CELL / 2);
    cell.symbolSprite.rotation = 0;
    cell.baseSymbolScale = cell.symbolSprite.scale.x;
    drawGlow(cell);
    drawValueLabel(cell);
    drawCascadeBadge(cell);
  }

  function drawValueLabel(cell: CellView, emphasisColor?: number) {
    cell.valueBg.clear();
    if (!cell.symbol || cell.symbol === "unstableRock") {
      cell.valueLabel.text = "";
      cell.valueLabel.alpha = 0;
      return;
    }
    const symbol = cell.symbol;
    const isCollector = isCollectorSymbol(symbol);
    const isEgg = symbol === "dragonEgg";
    const label = isCollector
      ? `${DRAGONFORGE_CONFIG.collectorMultipliers[symbol]}x`
      : `🪙${formatCredits(getScaledCollectableValue(symbol, collectableValueMultiplier) * currentStake)}`;
    cell.valueLabel.text = label;
    cell.valueLabel.style.fill = isCollector ? 0x2a1704 : (emphasisColor ?? (isEgg ? 0xccfbf1 : 0xf8f1dc));
    cell.valueLabel.alpha = isCollector || emphasisColor !== undefined ? 1 : isEgg ? 0.92 : 0.72;
    const halfWidth = cell.valueLabel.width / 2 + 7;
    const bgColor = isCollector ? 0xf5c542 : isEgg ? 0x042f2e : 0x120a08;
    cell.valueBg.alpha = isCollector || emphasisColor !== undefined ? 1 : 0.82;
    cell.valueBg
      .roundRect(CELL / 2 - halfWidth, CELL - 22, halfWidth * 2, 18, 9)
      .fill({ color: bgColor, alpha: isCollector ? 0.94 : 0.62 })
      .stroke({
        width: emphasisColor !== undefined ? 2 : 1,
        color: isCollector ? 0x8a5a12 : (emphasisColor ?? (isEgg ? 0x2dd4bf : 0xf8f1dc)),
        alpha: isCollector ? 0.65 : emphasisColor !== undefined ? 0.9 : 0.18
      });
  }

  function drawCascadeBadge(cell: CellView) {
    cell.cascadeBadgeBg.clear();
    cell.cascadeBadgeLabel.visible = false;
    if (!cell.symbol || cell.symbol === "unstableRock" || isCollectorSymbol(cell.symbol)) return;
    if (collectableValueMultiplier <= 1) return;

    const text = `${collectableValueMultiplier}x`;
    cell.cascadeBadgeLabel.text = text;
    cell.cascadeBadgeLabel.visible = true;
    const width = cell.cascadeBadgeLabel.width + 10;
    cell.cascadeBadgeLabel.position.set(CELL - 6, 8);
    cell.cascadeBadgeBg
      .roundRect(CELL - width - 4, 4, width, 16, 8)
      .fill({ color: 0x3a1500, alpha: 0.88 })
      .stroke({ width: 1, color: 0xf5c542, alpha: 0.65 });
  }

  function refreshValueDisplays() {
    for (const cell of cells) {
      if (!cell.symbol || cell.symbol === "unstableRock" || isCollectorSymbol(cell.symbol)) continue;
      drawValueLabel(cell);
      drawCascadeBadge(cell);
    }
  }

  function setCollectableValueMultiplier(multiplier: number) {
    collectableValueMultiplier = multiplier;
    refreshValueDisplays();
  }

  function setStake(stakeValue: number) {
    currentStake = stakeValue;
    refreshValueDisplays();
  }

  async function animateCollectableValueIncrease(nextMultiplier: number, gen: number, headline: string, detail: string) {
    if (nextMultiplier <= collectableValueMultiplier) {
      setCollectableValueMultiplier(nextMultiplier);
      return;
    }
    const activeCells = cells.filter((cell) => cell.symbol && cell.symbol !== "unstableRock" && !isCollectorSymbol(cell.symbol) && cell.symbolSprite.visible);
    const callout = buildValueRiseCallout(headline, detail);
    callout.position.set(BOARD_W / 2, 38);
    callout.alpha = 0;
    callout.scale.set(0.72);
    fxLayer.addChild(callout);
    let labelsUpdated = false;

    await runner.animate(600, (p) => {
      if (!labelsUpdated && p >= 0.36) {
        labelsUpdated = true;
        setCollectableValueMultiplier(nextMultiplier);
      }
      const pulse = Math.sin(Math.min(1, p / 0.78) * Math.PI);
      callout.alpha = p < 0.16 ? p / 0.16 : p > 0.82 ? 1 - (p - 0.82) / 0.18 : 1;
      callout.scale.set(0.72 + Easing.outBack(Math.min(1, p / 0.55)) * 0.28);
      for (const cell of activeCells) {
        cell.valueLabel.scale.set(1 + pulse * 0.24);
        cell.valueLabel.position.y = CELL - 13 - pulse * 5;
      }
    });
    if (!labelsUpdated) setCollectableValueMultiplier(nextMultiplier);
    if (callout.parent) callout.destroy({ children: true });
    for (const cell of activeCells) {
      cell.valueLabel.scale.set(1);
      cell.valueLabel.position.y = CELL - 13;
      drawValueLabel(cell);
    }
    if (gen !== currentGeneration) return;
  }

  function drawGlow(cell: CellView) {
    cell.glow.clear();
    if (!cell.symbol) return;
    if (isCollectorSymbol(cell.symbol)) {
      cell.glow.circle(CELL / 2, CELL / 2, CELL * 0.47).stroke({ width: 5, color: SYMBOL_COLORS[cell.symbol], alpha: 0.18 });
      cell.glow.circle(CELL / 2, CELL / 2, CELL * 0.435).stroke({ width: 2.5, color: SYMBOL_COLORS[cell.symbol], alpha: 0.78 });
    } else if (cell.symbol === "dragonEgg") {
      cell.glow.circle(CELL / 2, CELL / 2, CELL * 0.47).stroke({ width: 2.5, color: SYMBOL_COLORS.dragonEgg, alpha: 0.5 });
    }
  }

  function setCollectorTargetPreview(step: DragonforgeStep | undefined) {
    for (const cell of cells) {
      drawGlow(cell);
      drawValueLabel(cell);
      cell.valueLabel.scale.set(1);
    }

    const collectorsByTarget = new Map<string, CollectorType[]>();
    for (const route of step?.collectorRoutes ?? []) {
      for (const move of route.moves) {
        if (!move.collect) continue;
        const key = coordKey(move.x, move.y);
        const collectors = collectorsByTarget.get(key) ?? [];
        if (!collectors.includes(route.symbol)) collectors.push(route.symbol);
        collectorsByTarget.set(key, collectors);
      }
    }

    for (const [key, collectors] of collectorsByTarget) {
      const [x, y] = key.split(":").map(Number);
      const cell = cellAt(x, y);
      cell.glow.clear();
      collectors.slice(0, 4).forEach((collector, index) => {
        const radius = CELL * (0.47 - index * 0.045);
        cell.glow.circle(CELL / 2, CELL / 2, radius).stroke({ width: index === 0 ? 4 : 3, color: SYMBOL_COLORS[collector], alpha: 0.92 });
      });
      drawValueLabel(cell, SYMBOL_COLORS[collectors[0]]);
      cell.valueLabel.scale.set(1.06);
    }
  }

  function clearCollectorTargetPreview() {
    for (const cell of cells) {
      drawGlow(cell);
      drawValueLabel(cell);
      cell.valueLabel.scale.set(1);
    }
  }

  function setHoardTiles(active: boolean) {
    for (const cell of cells) {
      cell.tileBg.tint = active ? 0x3a2a12 : 0xffffff;
    }
  }

  function setPresentationLevel(level: number, bonus = false) {
    presentationLevel = Math.max(0, Math.min(5, Math.floor(level)));
    bonusPresentation = bonus;
    drawBoardFrame(frameGraphics, presentationLevel, bonus);
  }

  function setBoardInstant(board: BoardCell[]) {
    for (const cell of cells) {
      const data = board[cell.y * COLS + cell.x];
      applyCellSymbol(cell, data.symbol);
      cell.container.alpha = 1;
      cell.container.scale.set(1);
      cell.container.position.set(cell.baseX, cell.baseY);
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
        await runner.animate(300, (p) => {
          const eased = Easing.outBack(p);
          cell.container.alpha = Math.min(1, p * 1.4);
          cell.container.scale.set(0.5 + eased * 0.5);
          cell.container.position.y = cell.baseY - 26 * (1 - p);
        });
      })();
    });
    await Promise.all(jobs);
  }

  function spawnBurstParticles(targets: readonly { x: number; y: number; symbol: SymbolType }[]) {
    for (const { x, y, symbol } of targets) {
      const color = SYMBOL_COLORS[symbol];
      const [cx, cy] = cellCenter(x, y);
      const count = 6;
      for (let i = 0; i < count; i += 1) {
        const dot = new Graphics().circle(0, 0, 4 + Math.random() * 3).fill({ color, alpha: 1 });
        dot.blendMode = "add";
        dot.position.set(cx, cy);
        fxLayer.addChild(dot);
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 30 + Math.random() * 20;
        const tx = cx + Math.cos(angle) * dist;
        const ty = cy + Math.sin(angle) * dist;
        void runner
          .animate(
            520,
            (p) => {
              dot.position.set(cx + (tx - cx) * p, cy + (ty - cy) * p);
              dot.alpha = 1 - p;
              dot.scale.set(1 - p * 0.4);
            },
            Easing.outCubic
          )
          .then(() => dot.destroy());
      }
    }
  }

  function spawnRingPulse(x: number, y: number, color: number, opts: { size?: number; duration?: number; alpha?: number } = {}) {
    const [cx, cy] = cellCenter(x, y);
    const ring = new Graphics();
    ring.blendMode = "add";
    ring.position.set(cx, cy);
    fxLayer.addChild(ring);

    const startSize = (opts.size ?? CELL * 0.6) * 0.35;
    const endSize = opts.size ?? CELL * 0.6;
    const duration = opts.duration ?? 480;
    const peakAlpha = opts.alpha ?? 0.85;

    void runner
      .animate(duration, (p) => {
        const size = startSize + (endSize - startSize) * Easing.outCubic(p);
        const alpha = p < 0.2 ? (p / 0.2) * peakAlpha : peakAlpha * (1 - (p - 0.2) / 0.8);
        ring.clear().circle(0, 0, size).stroke({ width: 4, color, alpha });
      })
      .then(() => ring.destroy());
  }

  function spawnValueFly(x: number, y: number, symbol: SymbolType, collector: CollectorType) {
    const tokenMask = new Graphics().circle(0, 0, 12).fill(0xffffff);
    const token = new Sprite(getDragonforgeSymbolTexture(symbol));
    token.anchor.set(0.5);
    token.width = 26;
    token.height = 26;
    token.mask = tokenMask;
    const [startX, startY] = cellCenter(x, y);
    const targetX = potBadge.container.position.x + 80 - boardContainer.position.x;
    const targetY = potBadge.container.position.y - boardContainer.position.y;
    token.position.set(startX, startY);
    tokenMask.position.set(startX, startY);
    fxLayer.addChild(tokenMask, token);
    const color = SYMBOL_COLORS[collector];
    void runner
      .animate(600, (p) => {
        const eased = Easing.inOutQuad(p);
        const arc = Math.sin(p * Math.PI) * 58;
        const px = startX + (targetX - startX) * eased;
        const py = startY + (targetY - startY) * eased - arc;
        token.position.set(px, py);
        tokenMask.position.set(px, py);
        token.rotation += 0.08;
        token.alpha = p > 0.82 ? 1 - (p - 0.82) / 0.18 : 1;
      })
      .then(() => {
        token.destroy();
        tokenMask.destroy();
        potBadge.pulse(color);
      });
  }

  function spawnWinText(amount: number) {
    if (amount <= 0) return;
    const style = new TextStyle({
      fill: 0xffe6cf,
      fontSize: 30,
      fontWeight: "900",
      fontFamily: "system-ui, -apple-system, sans-serif",
      stroke: { color: 0x1c0a02, width: 5 }
    });
    const text = new Text({ text: `+${amount.toFixed(2)}`, style });
    text.anchor.set(0.5);
    text.position.set(BOARD_W / 2, BOARD_H / 2);
    text.alpha = 0;
    fxLayer.addChild(text);
    void runner
      .animate(1000, (p) => {
        text.alpha = p < 0.15 ? p / 0.15 : p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
        text.position.y = BOARD_H / 2 - p * 74;
      })
      .then(() => text.destroy());
  }

  type RenderCollectorRoute = NonNullable<DragonforgeStep["collectorRoutes"]>[number];

  function buildRouteTelegraph(route: RenderCollectorRoute): Graphics {
    const routeLine = new Graphics();
    const color = SYMBOL_COLORS[route.symbol];
    let [previousX, previousY] = cellCenter(route.x, route.y);
    for (const move of route.moves) {
      const [nextX, nextY] = cellCenter(move.x, move.y);
      routeLine.moveTo(previousX, previousY).lineTo(nextX, nextY).stroke({ width: 7, color, alpha: 0.1, cap: "round" });
      routeLine.moveTo(previousX, previousY).lineTo(nextX, nextY).stroke({ width: 2.5, color, alpha: 0.78, cap: "round" });
      if (move.collect) {
        routeLine.circle(nextX, nextY, 10).stroke({ width: 2, color: 0xffffff, alpha: 0.72 });
        routeLine.circle(nextX, nextY, 15).stroke({ width: 2, color, alpha: 0.5 });
      }
      previousX = nextX;
      previousY = nextY;
    }
    routeLine.alpha = 0;
    fxLayer.addChild(routeLine);
    return routeLine;
  }

  async function playCollectorAnticipation(route: RenderCollectorRoute, origin: CellView, gen: number): Promise<Graphics> {
    const routeLine = buildRouteTelegraph(route);
    dragonforgeSound.playTargetLock(route.symbol);
    await runner.animate(170, (p) => {
      focusShade.alpha = p * 0.26;
      routeLine.alpha = Easing.outQuad(p);
    });
    if (gen !== currentGeneration) return routeLine;

    const targets = route.moves.filter((move) => move.collect);
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      dragonforgeSound.playTargetLock(route.symbol, index);
      spawnRingPulse(target.x, target.y, SYMBOL_COLORS[route.symbol], { size: CELL * 1.0, duration: 250, alpha: 0.58 });
      const targetCell = cellAt(target.x, target.y);
      await runner.animate(90, (p) => targetCell.container.scale.set(1 + Math.sin(p * Math.PI) * 0.055));
      targetCell.container.scale.set(1);
      if (gen !== currentGeneration) return routeLine;
    }

    origin.motionLocked = true;
    await runner.animate(220, (p) => {
      const k = Math.sin(p * Math.PI);
      origin.symbolSprite.scale.set(origin.baseSymbolScale * (1 + k * 0.08));
      origin.glow.alpha = 0.55 + k * 0.45;
    });
    origin.motionLocked = false;
    origin.symbolSprite.scale.set(origin.baseSymbolScale);
    return routeLine;
  }

  async function playCollectorCelebration(symbol: CollectorType, mover: Container, aura: Graphics) {
    dragonforgeSound.playCollectorCelebrate(symbol);
    await runner.animate(220, (p) => {
      const bounce = Math.sin(p * Math.PI);
      aura.alpha = 0.45 + bounce * 0.55;
      mover.scale.set(1 + bounce * 0.05);
    });
    mover.scale.set(1);
    aura.alpha = 1;
  }

  async function playSharedEggCelebration(x: number, y: number, collectors: readonly CollectorType[], gen: number) {
    if (collectors.length < 2) return;
    dragonforgeSound.playEggShare(collectors.length);
    focusShade.alpha = 0.22;
    collectors.forEach((collector, index) => {
      void runner.wait(index * 75).then(() => {
        if (gen === currentGeneration) spawnRingPulse(x, y, SYMBOL_COLORS[collector], { size: CELL * (1.0 + index * 0.16), duration: 500, alpha: 0.78 });
      });
    });
    const egg = cellAt(x, y);
    egg.motionLocked = true;
    const label = new Text({
      text: `DRAGON EGG ×${collectors.length}`,
      style: new TextStyle({ fill: 0xccfbf1, fontSize: 18, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", stroke: { color: 0x042f2e, width: 5 } })
    });
    label.anchor.set(0.5);
    const [cx, cy] = cellCenter(x, y);
    label.position.set(cx, cy - 58);
    label.alpha = 0;
    fxLayer.addChild(label);
    await runner.animate(600, (p) => {
      const pulse = Math.sin(p * Math.PI * 3) * (1 - p);
      egg.symbolSprite.scale.set(egg.baseSymbolScale * (1 + pulse * 0.09));
      label.alpha = p < 0.2 ? p / 0.2 : p > 0.78 ? 1 - (p - 0.78) / 0.22 : 1;
      label.position.y = cy - 52 - Easing.outCubic(p) * 15;
    });
    egg.symbolSprite.scale.set(egg.baseSymbolScale);
    egg.motionLocked = false;
    label.destroy();
    focusShade.alpha = 0;
  }

  async function playCollectorRoutes(step: DragonforgeStep, prevBoard: BoardCell[], gen: number, comboStreak: number, stake: number) {
    const routes = step.collectorRoutes ?? [];
    if (routes.length === 0) return;

    const sharedEggs = new Map<string, { x: number; y: number; collectors: CollectorType[] }>();
    for (const route of routes) {
      for (const move of route.moves) {
        if (!move.collect || prevBoard[move.y * COLS + move.x].symbol !== "dragonEgg") continue;
        const key = coordKey(move.x, move.y);
        const entry = sharedEggs.get(key) ?? { x: move.x, y: move.y, collectors: [] };
        if (!entry.collectors.includes(route.symbol)) entry.collectors.push(route.symbol);
        sharedEggs.set(key, entry);
      }
    }

    if (step.winDelta) spawnWinText(step.winDelta * stake);
    dragonforgeSound.playCollect(comboStreak);

    for (const route of routes) {
      if (gen !== currentGeneration) return;
      const origin = cellAt(route.x, route.y);
      await playCollectorAnticipation(route, origin, gen);
      if (gen !== currentGeneration) return;
      hideCellVisualState(origin);

      const mover = new Container();
      const aura = new Graphics()
        .circle(0, 0, CELL * 0.46)
        .stroke({ width: 7, color: SYMBOL_COLORS[route.symbol], alpha: 0.16 })
        .circle(0, 0, CELL * 0.42)
        .stroke({ width: 3, color: SYMBOL_COLORS[route.symbol], alpha: 0.86 });
      const iconMask = new Graphics();
      drawSymbolMask(iconMask, route.symbol, CELL * 0.32);
      const icon = new Sprite(getDragonforgeSymbolTexture(route.symbol));
      icon.anchor.set(0.5);
      icon.width = CELL * 0.72;
      icon.height = CELL * 0.72;
      icon.mask = iconMask;
      mover.addChild(aura, iconMask, icon);
      const [originX, originY] = cellCenter(route.x, route.y);
      mover.position.set(originX, originY);
      fxLayer.addChild(mover);

      const moveTo = async (x: number, y: number, duration: number) => {
        const [targetX, targetY] = cellCenter(x, y);
        const startX = mover.position.x;
        const startY = mover.position.y;
        await runner.animate(duration, (p) => {
          const baseX = startX + (targetX - startX) * Easing.inOutQuad(p);
          const baseY = startY + (targetY - startY) * Easing.inOutQuad(p);
          const bob = -Math.sin(p * Math.PI) * 10;
          mover.position.set(baseX, baseY + bob);
          aura.rotation += 0.03;
        });
        mover.position.set(targetX, targetY);
      };

      try {
        for (const move of route.moves) {
          await moveTo(move.x, move.y, 240);
          if (gen !== currentGeneration) return;
          if (!move.collect) continue;

          const target = cellAt(move.x, move.y);
          const targetSymbol = prevBoard[move.y * COLS + move.x].symbol;
          dragonforgeSound.playCollectorImpact(route.symbol);
          spawnRingPulse(move.x, move.y, SYMBOL_COLORS[route.symbol], { size: CELL * 1.1, duration: 340, alpha: 0.7 });
          spawnBurstParticles([{ x: move.x, y: move.y, symbol: targetSymbol }]);

          const shared = sharedEggs.get(coordKey(move.x, move.y));
          if (shared && shared.collectors.length > 1) {
            await playSharedEggCelebration(move.x, move.y, shared.collectors, gen);
          } else {
            await playCollectorCelebration(route.symbol, mover, aura);
          }
          if (gen !== currentGeneration) return;

          if (targetSymbol !== "dragonEgg") {
            hideCellVisualState(target);
            spawnValueFly(move.x, move.y, targetSymbol, route.symbol);
          }
        }
      } finally {
        mover.destroy({ children: true });
      }

      origin.symbol = null;
      restoreCellVisualState(origin);
      origin.symbolSprite.visible = false;
      origin.symbolBezel.visible = false;
      origin.valueBg.visible = false;
      origin.valueLabel.visible = false;
      origin.glow.visible = false;
    }

    focusShade.alpha = 0;
  }

  async function playRefill(step: DragonforgeStep, gen: number) {
    const changes = step.changes ?? [];
    if (changes.length === 0) return;
    dragonforgeSound.playCascade(Math.min(5, changes.length));

    const jobs = changes.map((change) => {
      const cell = cellAt(change.x, change.y);
      return (async () => {
        await runner.wait(Math.random() * 90);
        if (gen !== currentGeneration) return;
        cell.container.position.set(cell.baseX, cell.baseY - 30);
        cell.container.alpha = 0;
        applyCellSymbol(cell, change.symbol);
        cell.container.scale.set(0.6);
        await runner.animate(280, (p) => {
          const eased = Easing.outBack(p);
          cell.container.alpha = Math.min(1, p * 1.6);
          cell.container.scale.set(0.6 + eased * 0.4);
          cell.container.position.y = cell.baseY - 30 * (1 - p);
        });
        cell.container.position.set(cell.baseX, cell.baseY);
        cell.container.scale.set(1);
      })();
    });
    await Promise.all(jobs);
  }

  async function playBanner(text: string, tone: "gold" | "teal", holdMs: number, gen: number) {
    const color = tone === "gold" ? 0xf5c542 : 0x2dd4bf;
    const banner = new Text({
      text,
      style: new TextStyle({ fill: 0xfff3d6, fontSize: 26, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", stroke: { color: 0x1c0a02, width: 5 }, letterSpacing: 1.2 })
    });
    banner.anchor.set(0.5);
    banner.position.set(BOARD_W / 2, BOARD_H / 2 - 70);
    banner.alpha = 0;
    banner.scale.set(0.7);
    fxLayer.addChild(banner);
    await runner.animate(260, (p) => {
      banner.alpha = Easing.outQuad(p);
      banner.scale.set(0.7 + Easing.outBack(p) * 0.3);
    });
    if (gen !== currentGeneration) return;
    await runner.wait(holdMs);
    if (gen !== currentGeneration) return;
    await runner.animate(220, (p) => {
      banner.alpha = 1 - p;
    });
    banner.destroy();
    void color;
  }

  async function playHoardTransformation(prevBoard: BoardCell[], gen: number) {
    shakeScreen(6, 260);
    await runner.animate(400, (p) => {
      focusShade.alpha = Math.sin(p * Math.PI) * 0.45;
    });
    if (gen !== currentGeneration) return;
    setBoardInstant(prevBoard);
  }

  async function playDragonWakeShudder(gen: number) {
    shakeScreen(10, 420);
    dragonforgeSound.playDragonWake();
    await runner.animate(420, (p) => {
      focusShade.alpha = Math.sin(p * Math.PI) * 0.5;
    });
    if (gen !== currentGeneration) return;
    focusShade.alpha = 0;
  }

  async function playWinCeremony(win: number, stake: number, capApplied: boolean, gen: number) {
    if (win <= 0) return;
    const presentation = getWinPresentation(win, stake, capApplied);
    if (presentation.tier === "standard") return;
    if (presentation.tier === "good") dragonforgeSound.playGoodWin();
    else if (presentation.tier === "big") dragonforgeSound.playBigWin();
    else if (presentation.tier === "mega") dragonforgeSound.playMegaWin();
    else dragonforgeSound.playMaxWin();

    focusShade.alpha = 0.4;
    const ceremony = new Container();
    const halo = new Graphics().circle(0, 0, 140).fill({ color: 0xf5c542, alpha: 0.14 });
    const title = new Text({
      text: presentation.label,
      style: new TextStyle({ fill: 0xffe6cf, fontSize: presentation.tier === "max" ? 34 : 26, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", stroke: { color: 0x1c0a02, width: 6 }, letterSpacing: 1.4 })
    });
    title.anchor.set(0.5);
    title.position.y = -30;
    const amount = new Text({
      text: "0.00",
      style: new TextStyle({ fill: 0xffe9a8, fontSize: presentation.tier === "max" ? 43 : 37, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", stroke: { color: 0x2b1904, width: 6 } })
    });
    amount.anchor.set(0.5);
    amount.position.y = 28;
    ceremony.addChild(halo, title, amount);
    ceremony.position.set(BOARD_W / 2, BOARD_H / 2);
    ceremony.scale.set(0.45);
    ceremony.alpha = 0;
    fxLayer.addChild(ceremony);

    await runner.animate(presentation.countMs, (p) => {
      ceremony.alpha = Math.min(1, p * 4);
      ceremony.scale.set(0.45 + Easing.outBack(Math.min(1, p * 2.2)) * 0.55);
      halo.rotation += 0.012 + presentation.intensity * 0.01;
      amount.text = (win * Easing.outCubic(p)).toFixed(2);
    });
    amount.text = win.toFixed(2);
    await runner.wait(presentation.holdMs);
    if (gen !== currentGeneration) return;
    await runner.animate(260, (p) => {
      ceremony.alpha = 1 - p;
      ceremony.scale.set(1 + p * 0.18);
      focusShade.alpha *= 1 - p;
    });
    ceremony.destroy({ children: true });
    focusShade.alpha = 0;
  }

  let currentGeneration = 0;
  let activeRound: DragonforgeRoundResult | null = null;

  async function playRound(
    round: DragonforgeRoundResult,
    onStepChange?: (index: number, step: DragonforgeStep, total: number) => void,
    onComplete?: (round: DragonforgeRoundResult) => void
  ) {
    const myGeneration = ++currentGeneration;
    activeRound = round;
    const frames = buildFrames(round);
    const stake = round.stake;
    let multiplier = 1;
    let comboStreak = 0;
    let cascadeCount = 0;
    let potCash = 0;
    let eggsSeenSoFar = round.initialBoard.filter((cell) => cell.symbol === "dragonEgg").length;
    let eggHintShown = false;
    let openingDelveConsumed = false;
    let delveIndex = 0;

    setCollectableValueMultiplier(1);
    setPresentationLevel(0, false);
    runner.cancelAll();
    clearFx();
    focusShade.alpha = 0;
    setHoardTiles(false);
    multiplierBadge.hide();
    potBadge.hide();
    eggTracker.hide();
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
          setCollectorTargetPreview(round.steps[i + 1]);
          potBadge.setAmount(0);
          potBadge.setSub(`Cascade 0/${DRAGONFORGE_CONFIG.maxBaseCascades} · ${dragonStateLabel(0)}`, "teal");
          potBadge.show();
          eggTracker.setProgress(Math.min(eggsSeenSoFar, DRAGONFORGE_CONFIG.bonusTriggerEggs));
          eggTracker.show();
          break;
        case "symbolsCollected":
          await playCollectorRoutes(step, prev, myGeneration, comboStreak, stake);
          if (myGeneration !== currentGeneration) return;
          clearCollectorTargetPreview();
          comboStreak += 1;
          cascadeCount += 1;
          potCash += (step.winDelta ?? 0) * stake;
          potBadge.setAmount(potCash);
          potBadge.setSub(`Cascade ${cascadeCount}/${DRAGONFORGE_CONFIG.maxBaseCascades} · ${dragonStateLabel(cascadeCount)}`, "teal");
          break;
        case "cascade": {
          const nextMultiplier = getCascadeValueMultiplier(cascadeCount + 1);
          await animateCollectableValueIncrease(nextMultiplier, myGeneration, "VEIN RICHER +50%", `CASCADE ${cascadeCount + 1} · VALUES ×${nextMultiplier}`);
          if (myGeneration !== currentGeneration) return;
          setPresentationLevel(cascadeCount, false);
          dragonforgeSound.playEscalation(cascadeCount);
          if (cascadeCount >= 3) shakeScreen(2 + cascadeCount * 0.4, 170);
          await playRefill(step, myGeneration);
          if (myGeneration !== currentGeneration) return;
          setCollectorTargetPreview(round.steps[i + 1]);
          break;
        }
        case "hoardTriggered":
          setCollectableValueMultiplier(1);
          setPresentationLevel(5, true);
          dragonforgeSound.playHoardTrigger();
          await playHoardTransformation(prev, myGeneration);
          if (myGeneration !== currentGeneration) return;
          eggTracker.hide();
          multiplierBadge.show();
          multiplier = 1;
          multiplierBadge.set(multiplier);
          setHoardTiles(true);
          potBadge.setSub("Dragon's Hoard!", "gold");
          await playBanner("DRAGON'S HOARD", "gold", 700, myGeneration);
          break;
        case "delveBreath": {
          if (!openingDelveConsumed) {
            openingDelveConsumed = true;
            potBadge.setSub("You press deeper...", "gold");
            await playRefill(step, myGeneration);
            break;
          }
          delveIndex += 1;
          if (step.collectorRoutes?.length || step.collected?.length) {
            const eggsRewarded = step.dragonEggsRewarded?.length ?? 0;
            setCollectorTargetPreview(step);
            await runner.wait(200);
            if (myGeneration !== currentGeneration) return;
            await playCollectorRoutes(step, prev, myGeneration, comboStreak, stake);
            if (myGeneration !== currentGeneration) return;
            clearCollectorTargetPreview();
            comboStreak += 1;
            potCash += (step.winDelta ?? 0) * stake;
            potBadge.setAmount(potCash);
            if (eggsRewarded > 0) {
              multiplier += eggsRewarded;
              await animateCollectableValueIncrease(multiplier, myGeneration, `EGG POWER +${eggsRewarded}x`, `ALL VALUES ×${multiplier}`);
              if (myGeneration !== currentGeneration) return;
              multiplierBadge.set(multiplier);
              dragonforgeSound.playMultiplierUp();
            }
          }
          dragonforgeSound.playDelve(delveIndex);
          await playRefill(step, myGeneration);
          if (myGeneration !== currentGeneration) return;
          potBadge.setSub(`Delve ${delveIndex} · secured so far`, "gold");
          break;
        }
        case "hoardEnded": {
          const woke = step.message.includes("dragon wakes");
          if (woke) await playDragonWakeShudder(myGeneration);
          if (myGeneration !== currentGeneration) return;
          dragonforgeSound.playHoardEnd();
          await playBanner(woke ? "THE DRAGON WAKES" : "YOU SURFACE SAFELY", woke ? "gold" : "teal", 700, myGeneration);
          if (myGeneration !== currentGeneration) return;
          multiplierBadge.hide();
          setHoardTiles(false);
          potBadge.setSub("Hoard complete", "gold");
          break;
        }
        case "roundEnded": {
          potCash = round.cappedWin;
          potBadge.setAmount(potCash);
          potBadge.setSub("Round complete", round.cappedWin > 0 ? "gold" : "teal");
          await playWinCeremony(round.cappedWin, stake, round.capApplied, myGeneration);
          break;
        }
        default:
          break;
      }

      if (myGeneration !== currentGeneration) return;

      if (step.type === "cascade" || step.type === "boardGenerated") {
        const newEggs = step.type === "cascade" ? (step.changes ?? []).filter((c) => c.symbol === "dragonEgg").length : 0;
        eggsSeenSoFar += newEggs;
        if (newEggs > 0) eggTracker.setProgress(Math.min(eggsSeenSoFar, DRAGONFORGE_CONFIG.bonusTriggerEggs));
        if (!eggHintShown && eggsSeenSoFar === DRAGONFORGE_CONFIG.bonusTriggerEggs - 1) {
          eggHintShown = true;
          dragonforgeSound.playEggHint();
        }
      }

      onStepChange?.(i, step, round.steps.length);
      await runner.wait(pacingDelay(step));
    }

    if (myGeneration !== currentGeneration) return;
    onComplete?.(round);
  }

  function dragonStateLabel(cascadesSoFar: number): string {
    const state = getDragonState(cascadesSoFar);
    const label = state.charAt(0).toUpperCase() + state.slice(1);
    return `🐉 ${label}`;
  }

  function setStatus(message: string) {
    statusText.text = message;
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
    focusShade.alpha = 0;

    let hoardActive = false;
    let multiplier = 1;
    let cascadeCount = 0;
    let refillCount = 0;
    let potCash = 0;
    let eggsSeenSoFar = activeRound.initialBoard.filter((cell) => cell.symbol === "dragonEgg").length;
    let delveIndex = 0;
    for (let i = 0; i <= clamped; i += 1) {
      const step = activeRound.steps[i];
      if (step.type === "symbolsCollected") {
        if (!hoardActive) cascadeCount += 1;
        potCash += (step.winDelta ?? 0) * stake;
      }
      if (step.type === "cascade") {
        refillCount += 1;
        eggsSeenSoFar += (step.changes ?? []).filter((c) => c.symbol === "dragonEgg").length;
      }
      if (step.type === "hoardTriggered") {
        hoardActive = true;
        multiplier = 1;
      }
      if (step.type === "hoardEnded") hoardActive = false;
      if (step.type === "delveBreath") {
        if (step.collectorRoutes?.length || step.collected?.length) {
          multiplier += step.dragonEggsRewarded?.length ?? 0;
          potCash += (step.winDelta ?? 0) * stake;
          delveIndex += 1;
        }
      }
      if (step.type === "roundEnded") potCash = activeRound.cappedWin;
    }

    setHoardTiles(hoardActive);
    setPresentationLevel(refillCount, hoardActive);
    const currentType = activeRound.steps[clamped]?.type;
    if (hoardActive) {
      multiplierBadge.show();
      multiplierBadge.set(multiplier);
      potBadge.setSub(delveIndex > 0 ? `Delve ${delveIndex} · secured so far` : "You press deeper...", "gold");
    } else {
      multiplierBadge.hide();
      if (currentType === "roundEnded") {
        potBadge.setSub("Round complete", activeRound.cappedWin > 0 ? "gold" : "teal");
      } else if (currentType === "hoardEnded") {
        potBadge.setSub("Hoard complete", "gold");
      } else {
        potBadge.setSub(`Cascade ${cascadeCount}/${DRAGONFORGE_CONFIG.maxBaseCascades} · ${dragonStateLabel(cascadeCount)}`, "teal");
      }
    }
    if (currentType) {
      potBadge.setAmount(potCash);
      potBadge.show();
    } else {
      potBadge.hide();
    }
    eggTracker.setProgress(Math.min(eggsSeenSoFar, DRAGONFORGE_CONFIG.bonusTriggerEggs));
    eggTracker.container.visible = !hoardActive && currentType !== "roundEnded" && currentType !== undefined;
    setCollectableValueMultiplier(hoardActive ? multiplier : getCascadeValueMultiplier(refillCount + 1));
    setBoardInstant(board);
    setStatus(activeRound.steps[clamped]?.message ?? "");
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
    runner.destroy();
  }

  setHoardTiles(false);
  setPresentationLevel(0, false);
  for (const cell of cells) cell.container.alpha = 0;

  return { resize, playRound, seek, skipToEnd, setStake, destroy };
}

function drawTileBevel(g: Graphics) {
  g.roundRect(5, 5, CELL - 10, CELL - 10, 19).stroke({ width: 1.5, color: 0xfff0dc, alpha: 0.12 });
  g.roundRect(8, 9, CELL - 16, CELL - 18, 16).stroke({ width: 2.5, color: 0x050302, alpha: 0.28 });
}

function buildValueRiseCallout(headline: string, detail: string): Container {
  const container = new Container();
  const title = new Text({
    text: headline,
    style: new TextStyle({ fill: 0xffe9a8, fontSize: 19, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: 0.8 })
  });
  title.anchor.set(0.5);
  title.position.set(0, -8);
  const sub = new Text({
    text: detail,
    style: new TextStyle({ fill: 0xccfbf1, fontSize: 11, fontWeight: "800", fontFamily: "system-ui, -apple-system, sans-serif", letterSpacing: 0.6 })
  });
  sub.anchor.set(0.5);
  sub.position.set(0, 13);
  const width = Math.max(230, title.width + 40, sub.width + 34);
  const bg = new Graphics()
    .roundRect(-width / 2, -27, width, 54, 18)
    .fill({ color: 0x1c0a02, alpha: 0.92 })
    .stroke({ width: 2, color: 0xf5c542, alpha: 0.7 });
  container.addChild(bg, title, sub);
  return container;
}

function drawBoardFrame(g: Graphics, level = 0, bonus = false) {
  const pad = 14;
  const x = -pad;
  const y = -pad;
  const w = BOARD_W + pad * 2;
  const h = BOARD_H + pad * 2;
  g.clear();

  const energy = Math.max(0, Math.min(1, level / 5));
  const frameColor = bonus ? 0xf5c542 : lerpColor(0xc2410c, 0x2dd4bf, energy);
  for (let i = 4; i >= 1; i -= 1) {
    g.roundRect(x - i * 2, y - i * 2, w + i * 4, h + i * 4, 26 + i * 2).stroke({
      width: 3,
      color: frameColor,
      alpha: (0.025 + energy * 0.035 + (bonus ? 0.025 : 0)) * i
    });
  }

  g.roundRect(x, y, w, h, 26).stroke({ width: 10, color: 0x1c0a02, alpha: 0.94 });
  g.roundRect(x + 6, y + 6, w - 12, h - 12, 22).stroke({ width: 3 + energy * 1.5, color: frameColor, alpha: 0.38 + energy * 0.3 });
  g.roundRect(x + 3, y + 3, w - 6, h - 6, 24).stroke({ width: 1.2, color: 0xffe6cf, alpha: 0.2 + energy * 0.16 });
}

function buildCellView(x: number, y: number): CellView {
  const baseX = x * (CELL + GAP);
  const baseY = y * (CELL + GAP);
  const container = new Container();
  container.position.set(baseX, baseY);

  const tileBg = new Graphics().roundRect(0, 0, CELL, CELL, 18).fill({ color: 0x241611 }).stroke({ width: 1.5, color: 0x40281c, alpha: 0.8 });
  container.addChild(tileBg);

  const tileDepth = new Graphics();
  tileDepth.roundRect(8, 8, CELL - 16, CELL - 16, 17).fill({ color: 0x020100, alpha: 0.1 });
  container.addChild(tileDepth);

  const glow = new Graphics();
  container.addChild(glow);

  const symbolMask = new Graphics();
  symbolMask.position.set(CELL / 2, CELL / 2);
  container.addChild(symbolMask);

  const symbolSprite = new Sprite();
  symbolSprite.anchor.set(0.5);
  symbolSprite.position.set(CELL / 2, CELL / 2);
  symbolSprite.mask = symbolMask;
  container.addChild(symbolSprite);

  const symbolBezel = new Graphics();
  symbolBezel.position.set(CELL / 2, CELL / 2);
  container.addChild(symbolBezel);

  const bevel = new Graphics();
  drawTileBevel(bevel);
  container.addChild(bevel);

  const valueBg = new Graphics();
  container.addChild(valueBg);

  const valueLabel = new Text({
    text: "",
    style: new TextStyle({ fill: 0xf8f1dc, fontSize: 12, fontWeight: "800", fontFamily: "system-ui, -apple-system, sans-serif" })
  });
  valueLabel.anchor.set(0.5);
  valueLabel.position.set(CELL / 2, CELL - 13);
  container.addChild(valueLabel);

  const cascadeBadgeBg = new Graphics();
  container.addChild(cascadeBadgeBg);

  const cascadeBadgeLabel = new Text({
    text: "",
    style: new TextStyle({ fill: 0xffe9a8, fontSize: 10, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif" })
  });
  cascadeBadgeLabel.anchor.set(1, 0);
  cascadeBadgeLabel.visible = false;
  container.addChild(cascadeBadgeLabel);

  return {
    x,
    y,
    baseX,
    baseY,
    symbol: null,
    container,
    tileBg,
    glow,
    symbolSprite,
    symbolMask,
    symbolBezel,
    baseSymbolScale: 1,
    valueBg,
    valueLabel,
    cascadeBadgeBg,
    cascadeBadgeLabel,
    motionLocked: false
  };
}

function buildMultiplierBadge() {
  const container = new Container();
  const bg = new Graphics().roundRect(-46, -18, 92, 36, 14).fill({ color: 0x1c0a02, alpha: 0.85 }).stroke({ width: 2, color: 0xf5c542, alpha: 0.7 });
  const text = new Text({
    text: "x1",
    style: new TextStyle({ fill: 0xffe9a8, fontSize: 20, fontWeight: "900", fontFamily: "system-ui, -apple-system, sans-serif" })
  });
  text.anchor.set(1, 0.5);
  text.position.set(30, 0);
  const star = new Text({ text: "🔥", style: new TextStyle({ fontSize: 16 }) });
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

function buildPotBadge() {
  const PADDING_X = 18;
  const MIN_WIDTH = 160;
  const AMOUNT_Y = -20;
  const SUB_Y = 12;

  const container = new Container();
  const bg = new Graphics();
  container.addChild(bg);

  const amountText = new Text({
    text: "🪙 0.00",
    style: new TextStyle({
      fill: 0xffe6cf,
      fontSize: 24,
      fontWeight: "900",
      fontFamily: "system-ui, -apple-system, sans-serif",
      stroke: { color: 0x1c0a02, width: 4 }
    })
  });
  amountText.anchor.set(0, 0);
  amountText.position.set(PADDING_X, AMOUNT_Y);
  container.addChild(amountText);

  const subText = new Text({
    text: "",
    style: new TextStyle({ fill: 0xd8c3b0, fontSize: 12, fontWeight: "700", fontFamily: "system-ui, -apple-system, sans-serif" })
  });
  subText.anchor.set(0, 0);
  subText.position.set(PADDING_X, SUB_Y);
  container.addChild(subText);

  container.visible = false;
  let lastTone: "gold" | "teal" = "teal";

  function contentWidth(): number {
    return Math.max(MIN_WIDTH, amountText.width + PADDING_X * 2, subText.width + PADDING_X * 2);
  }

  function redrawBg(tone: "gold" | "teal") {
    lastTone = tone;
    const width = contentWidth();
    bg
      .clear()
      .roundRect(0, AMOUNT_Y - 8, width, 54, 16)
      .fill({ color: 0x1c0f0a, alpha: 0.94 })
      .stroke({ width: 2.5, color: tone === "gold" ? 0xf5c542 : 0x2dd4bf, alpha: 0.75 });
  }
  redrawBg("teal");

  return {
    container,
    show() {
      container.visible = true;
    },
    hide() {
      container.visible = false;
    },
    setSub(label: string, tone: "gold" | "teal" = "teal") {
      subText.text = label;
      redrawBg(tone);
    },
    setAmount(cash: number) {
      amountText.text = `🪙 ${cash.toFixed(2)}`;
      redrawBg(lastTone);
      amountText.scale.set(1.16);
      const start = performance.now();
      const bump = () => {
        const p = Math.min(1, (performance.now() - start) / 220);
        amountText.scale.set(1.16 - 0.16 * Easing.outQuad(p));
        if (p < 1) requestAnimationFrame(bump);
      };
      requestAnimationFrame(bump);
    },
    pulse(color = 0xf5c542) {
      container.scale.set(1.1);
      bg.tint = color;
      const start = performance.now();
      const bump = () => {
        const p = Math.min(1, (performance.now() - start) / 260);
        container.scale.set(1.1 - 0.1 * Easing.outQuad(p));
        bg.tint = lerpColor(color, 0xffffff, p);
        if (p < 1) requestAnimationFrame(bump);
        else bg.tint = 0xffffff;
      };
      requestAnimationFrame(bump);
    }
  };
}

/** Persistent "N of 3 Dragon Eggs seen" tracker — dim pips light up as eggs land. */
function buildEggTracker(total: number) {
  const container = new Container();
  const spacing = 26;
  const startX = (-(total - 1) * spacing) / 2;
  const pips: Array<{ shape: Graphics; glow: Graphics; x: number }> = [];

  for (let i = 0; i < total; i += 1) {
    const x = startX + i * spacing;
    const glow = new Graphics();
    glow.position.set(x, 0);
    container.addChild(glow);
    const shape = new Graphics();
    shape.ellipse(0, 0, 8, 10).fill({ color: SYMBOL_COLORS.dragonEgg });
    shape.position.set(x, 0);
    container.addChild(shape);
    pips.push({ shape, glow, x });
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
        pip.shape.alpha = lit ? 1 : 0.3;
        pip.shape.tint = lit ? 0xffffff : 0x555555;
        pip.glow.clear();
        if (lit) pip.glow.circle(0, 0, 14).fill({ color: 0x2dd4bf, alpha: 0.4 });
      });
    }
  };
}
