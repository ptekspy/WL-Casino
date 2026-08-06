import { createRng, xmur3 } from "./engine/rng";
import { roundMoney, roundRatio, formatWin, percentile } from "./engine/money";
import { buildNeighbourIndex } from "./engine/board";
import { resolveCollection as resolveCollectionEngine, type CollectionEngineConfig } from "./engine/collection";
import { buildFrames as buildFramesEngine, applyChanges as applyChangesEngine } from "./engine/replay";
import type { Rng } from "./engine/rng";

export type SymbolType = "stone" | "iron" | "gold" | "gem" | "relic" | "unstableRock" | "dragonEgg" | "miner" | "prospector" | "smith" | "scout";
export type CollectorType = Extract<SymbolType, "miner" | "prospector" | "smith" | "scout">;

export type BoardCell = {
  id: string;
  x: number;
  y: number;
  symbol: SymbolType;
  value: number;
};

/** A single cell mutation. Replay steps carry these instead of full board clones. */
export type CellChange = {
  x: number;
  y: number;
  symbol: SymbolType;
};

/** One adjacent movement made by a collector. `collect` marks an impact at the destination. */
export type CollectorRouteMove = {
  x: number;
  y: number;
  collect?: true;
};

/**
 * Server-authored collection movement for one collector. The client follows
 * `moves` in order, then restores the collector at its starting cell without
 * visibly retracing already-cleared squares.
 */
export type CollectorRoute = {
  x: number;
  y: number;
  symbol: CollectorType;
  moves: CollectorRouteMove[];
};

export type DragonforgeStepType =
  | "boardGenerated"
  | "symbolsCollected"
  | "cascade"
  | "hoardTriggered"
  | "delveBreath"
  | "hoardEnded"
  | "roundEnded";

export type DragonforgeStep = {
  type: DragonforgeStepType;
  message: string;
  winDelta?: number;
  /** Cells whose symbol changed during this step. Apply in order over `initialBoard`. */
  changes?: CellChange[];
  /** Unique normal cells removed after every collector has completed its route. */
  collected?: Array<{ x: number; y: number }>;
  /** Persistent Dragon Eggs rewarded during this step. They are never removed. */
  dragonEggsRewarded?: Array<{ x: number; y: number }>;
  /** Deterministic collector movement and ownership for replay animation. */
  collectorRoutes?: CollectorRoute[];
};

export type DragonforgeBonusResult = {
  triggered: true;
  delvesUsed: number;
  bonusWin: number;
  peakMultiplier: number;
  collectorsHeld: number;
  /** True if the dragon woke and cut the Hoard short; false if it ran out the maxDelves safety net instead. */
  dragonWoke: boolean;
};

export type DragonforgeRoundResult = {
  roundId: string;
  seed: string;
  stake: number;
  baseWin: number;
  uncappedWin: number;
  cappedWin: number;
  capApplied: boolean;
  initialBoard: BoardCell[];
  finalBoard: BoardCell[];
  bonus?: DragonforgeBonusResult;
  dragonEggsSeen: number;
  cascades: number;
  steps: DragonforgeStep[];
};

export type SimulationSummary = {
  runs: number;
  rtp: number;
  uncappedRtp: number;
  baseRtp: number;
  bonusRtp: number;
  houseEdge: number;
  hitRate: number;
  profitWinRate: number;
  deadBoardRate: number;
  bonusRate: number;
  nearMissRate: number;
  averageCascades: number;
  maxWinHits: number;
  highestUncappedWin: number;
  capRtpRemoved: number;
  medianWin: number;
  p95Win: number;
  p99Win: number;
  /** Fraction of Hoard bonuses that ended because the dragon woke, rather than exhausting maxDelves. */
  dragonWakeRate: number;
  averageDelves: number;
};

export type DragonState = "sleeping" | "stirring" | "alert" | "awake";

export const DRAGONFORGE_CONFIG = {
  width: 6,
  height: 6,
  maxWin: 1000,
  maxBaseCascades: 6,
  bonusTriggerEggs: 3,
  /** Push-your-luck safety net — the loop always terminates even if the wake roll never lands. */
  maxDelves: 30,
  /** Stakes the server will accept. The client select must be a subset of this. */
  allowedStakes: [0.2, 0.5, 1, 2, 5] as const,
  /** Design target. `pnpm test` asserts the simulated RTP stays inside rtpTolerance of this. */
  targetRtp: 0.95,
  rtpTolerance: 0.01,

  /**
   * Global payout scalars, resolved numerically by `pnpm sim -- --game dragonforge --tune`.
   * Changing any weight, value, or delve-wake curve below invalidates these — re-run the tuner.
   */
  baseScalar: 1.10578,
  delveScalar: 0.7374,

  /**
   * Chance the dragon wakes before the *next* delve, checked after each
   * delve's collection has already paid out (collected treasure is always
   * secured — only the following delve's potential is at risk). Escalates
   * every delve so the Hoard can't run forever.
   */
  delveBaseWakeChance: 0.08,
  delveWakeChanceStep: 0.045,
  delveMaxWakeChance: 0.6,

  /**
   * Base-game reel weights, summing to 100.
   * Collectors total 0.90 — this is the main hit-rate lever, same shape as Wildwood's.
   */
  symbolWeights: [
    { symbol: "stone", weight: 30 },
    { symbol: "iron", weight: 20 },
    { symbol: "gold", weight: 13 },
    { symbol: "gem", weight: 8 },
    { symbol: "relic", weight: 5 },
    { symbol: "unstableRock", weight: 22.05 },
    { symbol: "dragonEgg", weight: 1.05 },
    { symbol: "miner", weight: 0.3 },
    { symbol: "prospector", weight: 0.25 },
    { symbol: "smith", weight: 0.25 },
    { symbol: "scout", weight: 0.1 }
  ] satisfies Array<{ symbol: SymbolType; weight: number }>,

  /**
   * Delve reel weights. Richer in collectors and eggs than the base reel —
   * this is what drives the Hoard's tail toward the 1000x cap.
   */
  bonusSymbolWeights: [
    { symbol: "stone", weight: 22 },
    { symbol: "iron", weight: 18 },
    { symbol: "gold", weight: 15 },
    { symbol: "gem", weight: 12 },
    { symbol: "relic", weight: 10 },
    { symbol: "unstableRock", weight: 9 },
    { symbol: "dragonEgg", weight: 8 },
    { symbol: "miner", weight: 2.2 },
    { symbol: "prospector", weight: 1.6 },
    { symbol: "smith", weight: 1.6 },
    { symbol: "scout", weight: 0.6 }
  ] satisfies Array<{ symbol: SymbolType; weight: number }>,

  symbolValues: {
    stone: 0.02,
    iron: 0.045,
    gold: 0.09,
    gem: 0.16,
    relic: 0.3,
    unstableRock: 0,
    dragonEgg: 0.5,
    miner: 0,
    prospector: 0,
    smith: 0,
    scout: 0
  } satisfies Record<SymbolType, number>,

  collectorTargets: {
    miner: ["stone", "iron"],
    prospector: ["iron", "gold", "gem"],
    smith: ["gold", "gem", "relic"],
    scout: ["stone", "iron", "gold", "gem", "relic", "dragonEgg"]
  } satisfies Record<CollectorType, SymbolType[]>,

  /** Per-collector payout multiplier. Rarer collectors with richer targets pay more. */
  collectorMultipliers: {
    miner: 1,
    prospector: 1.5,
    smith: 2,
    scout: 3
  } satisfies Record<CollectorType, number>,

  /** Collectable value rises by 50% on every successive base-game cascade. */
  cascadeMultipliers: [1, 1.5, 2, 2.5, 3, 3.5] as const,

  /** Cells rerolled per delve. Drives how fast the board turns over underground. */
  delveRerollPerDelve: { min: 4, max: 8 }
};

/** Returns the authoritative collectable-value multiplier for a base-game cascade. */
export function getCascadeValueMultiplier(cascade: number): number {
  const safeCascade = Number.isFinite(cascade) ? Math.max(1, Math.floor(cascade)) : 1;
  const index = Math.min(safeCascade, DRAGONFORGE_CONFIG.cascadeMultipliers.length) - 1;
  return DRAGONFORGE_CONFIG.cascadeMultipliers[index];
}

/** Scales a symbol's displayed collectable value without applying internal RTP scalars. */
export function getScaledCollectableValue(symbol: SymbolType, multiplier: number): number {
  const safeMultiplier = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;
  return Number((DRAGONFORGE_CONFIG.symbolValues[symbol] * safeMultiplier).toFixed(6));
}

/**
 * Presentation-only HUD state driven by how many base-game cascades have
 * fired this round. Has no effect on payout — the Hoard bonus's wake curve
 * is the actual risk mechanic (see resolveHoard).
 */
export function getDragonState(cascadesSoFar: number): DragonState {
  if (cascadesSoFar <= 0) return "sleeping";
  if (cascadesSoFar <= 2) return "stirring";
  if (cascadesSoFar <= 4) return "alert";
  return "awake";
}

const { width, height } = DRAGONFORGE_CONFIG;
const BOARD_SIZE = width * height;

/** Precomputed adjacency, built once. Avoids the O(n^2) board scan per collector. */
const NEIGHBOUR_INDEX: readonly (readonly number[])[] = buildNeighbourIndex(width, height);

/** Precomputed target lookups, so collection is a Set hit rather than an array scan. */
const TARGET_SETS: Record<CollectorType, ReadonlySet<SymbolType>> = {
  miner: new Set(DRAGONFORGE_CONFIG.collectorTargets.miner),
  prospector: new Set(DRAGONFORGE_CONFIG.collectorTargets.prospector),
  smith: new Set(DRAGONFORGE_CONFIG.collectorTargets.smith),
  scout: new Set(DRAGONFORGE_CONFIG.collectorTargets.scout)
};

/** Wires Dragonforge's config into the shared collector-claim engine (see engine/collection.ts). */
const COLLECTION_CONFIG: CollectionEngineConfig<SymbolType> = {
  neighbourIndex: NEIGHBOUR_INDEX,
  isCollector,
  targetsFor: (collector) => TARGET_SETS[collector as CollectorType],
  multiplierFor: (collector) => DRAGONFORGE_CONFIG.collectorMultipliers[collector as CollectorType],
  sharedSymbol: "dragonEgg"
};

/** Mutable per-round state. `gen` gives every produced cell a unique id for React keys. */
type RoundContext = {
  rng: Rng;
  gen: number;
};

export function resolveDragonforgeRound(input: { seed: string; stake?: number }): DragonforgeRoundResult {
  const stake = input.stake ?? 1;
  const context: RoundContext = { rng: createRng(input.seed), gen: 0 };
  const roundId = createRoundId(input.seed);
  const steps: DragonforgeStep[] = [];

  const board = createBoard(context);
  const initialBoard = cloneBoard(board);
  let baseWin = 0;
  let cascades = 0;
  let dragonEggsSeen = countSymbols(board, "dragonEgg");

  steps.push({ type: "boardGenerated", message: "You break into a fresh 6×6 chamber." });

  for (let cascade = 1; cascade <= DRAGONFORGE_CONFIG.maxBaseCascades; cascade += 1) {
    const cascadeMultiplier = getCascadeValueMultiplier(cascade);
    const collection = resolveCollection(board, cascadeMultiplier * DRAGONFORGE_CONFIG.baseScalar);
    if (collection.collectorRoutes.length === 0) break;

    const rewardedTargets = collection.indices.length + collection.dragonEggIndices.length;
    cascades += 1;
    baseWin += collection.win;
    steps.push({
      type: "symbolsCollected",
      message: `Cascade ${cascade}: the crew hauled ${rewardedTargets} target${rewardedTargets === 1 ? "" : "s"} at ${cascadeMultiplier}x for ${formatWin(collection.win)}x.`,
      winDelta: collection.win,
      collected: collection.indices.map((index) => ({ x: board[index].x, y: board[index].y })),
      dragonEggsRewarded: collection.dragonEggIndices.map((index) => ({ x: board[index].x, y: board[index].y })),
      collectorRoutes: collection.collectorRoutes
    });

    // A persistent egg can pay on a turn, but it cannot create another turn by
    // itself because the board did not change.
    if (collection.indices.length === 0) break;

    // Refill only removed normal symbols. Dragon Eggs remain on the board.
    const changes = refill(board, collection.indices, context, DRAGONFORGE_CONFIG.symbolWeights);
    dragonEggsSeen += changes.filter((change) => change.symbol === "dragonEgg").length;
    steps.push({ type: "cascade", message: `Cascade ${cascade}: the chamber refills.`, changes });
  }

  let bonusWin = 0;
  let bonus: DragonforgeBonusResult | undefined;

  if (dragonEggsSeen >= DRAGONFORGE_CONFIG.bonusTriggerEggs) {
    steps.push({ type: "hoardTriggered", message: `${dragonEggsSeen} Dragon Eggs seen. The Dragon's Hoard opens.` });
    bonus = resolveHoard(board, context, steps);
    bonusWin = bonus.bonusWin;
  }

  const uncappedWin = roundMoney((baseWin + bonusWin) * stake);
  const cappedWin = roundMoney(Math.min(uncappedWin, DRAGONFORGE_CONFIG.maxWin * stake));
  const capApplied = uncappedWin > cappedWin;

  steps.push({
    type: "roundEnded",
    message: capApplied
      ? `Round ended at the ${DRAGONFORGE_CONFIG.maxWin}x cap. Uncapped potential was ${formatWin(uncappedWin / stake)}x.`
      : `Round ended with ${formatWin(cappedWin / stake)}x paid.`,
    winDelta: cappedWin
  });

  return {
    roundId,
    seed: input.seed,
    stake,
    baseWin: roundMoney(baseWin * stake),
    uncappedWin,
    cappedWin,
    capApplied,
    initialBoard,
    finalBoard: cloneBoard(board),
    bonus,
    dragonEggsSeen,
    cascades,
    steps
  };
}

/**
 * Dragon's Hoard bonus — push-your-luck, not hold-and-win.
 *
 * Each delve, every held collector collects again at a rising multiplier
 * (the multiplier climbs with every Dragon Egg collected, same shape as
 * Wildwood's hold-and-win). What's collected on a delve is paid immediately —
 * "secured" the instant it's claimed. Only *after* paying out does the dragon
 * get a chance to wake, with an escalating probability each successive
 * delve; if it does, the Hoard ends right there and everything collected so
 * far is kept. This is the actual differentiator from Wildwood's bonus:
 * treasure already hauled can never be lost, but every additional delve
 * risks ending the run before its own payout lands.
 */
function resolveHoard(board: BoardCell[], context: RoundContext, steps: DragonforgeStep[]): DragonforgeBonusResult {
  let delve = 0;
  let bonusWin = 0;
  let multiplier = 1;
  let wakeChance = DRAGONFORGE_CONFIG.delveBaseWakeChance;
  let dragonWoke = false;

  // Seed the feature board so held collectors have somewhere to grow.
  const openingChanges = rerollAll(board, context);
  steps.push({ type: "delveBreath", message: "You press deeper into the mine. Collectors that land are held.", changes: openingChanges });

  while (delve < DRAGONFORGE_CONFIG.maxDelves) {
    delve += 1;

    const mutationChanges = mutate(board, context);
    const collection = resolveCollection(board, multiplier * DRAGONFORGE_CONFIG.delveScalar);
    const eggsTaken = collection.dragonEggsCollected;
    multiplier += eggsTaken;

    bonusWin += collection.win;
    const refillChanges = collection.indices.length > 0 ? refill(board, collection.indices, context, DRAGONFORGE_CONFIG.bonusSymbolWeights) : [];

    steps.push({
      type: "delveBreath",
      message: `Delve ${delve}: hauled ${formatWin(collection.win)}x at ${multiplier}x, secured.`,
      winDelta: collection.win,
      changes: [...mutationChanges, ...refillChanges],
      collected: collection.indices.map((index) => ({ x: board[index].x, y: board[index].y })),
      dragonEggsRewarded: collection.dragonEggIndices.map((index) => ({ x: board[index].x, y: board[index].y })),
      collectorRoutes: collection.collectorRoutes
    });

    dragonWoke = context.rng.chance(wakeChance);
    if (dragonWoke) break;
    wakeChance = Math.min(DRAGONFORGE_CONFIG.delveMaxWakeChance, wakeChance + DRAGONFORGE_CONFIG.delveWakeChanceStep);
  }

  const roundedBonusWin = roundMoney(bonusWin);
  const collectorsHeld = countCollectors(board);
  steps.push({
    type: "hoardEnded",
    message: dragonWoke
      ? `The dragon wakes after ${delve} delve${delve === 1 ? "" : "s"}. You escape with ${formatWin(roundedBonusWin)}x, already secured.`
      : `You surface after ${delve} delves with ${formatWin(roundedBonusWin)}x secured.`,
    winDelta: roundedBonusWin
  });

  return { triggered: true, delvesUsed: delve, bonusWin: roundedBonusWin, peakMultiplier: multiplier, collectorsHeld, dragonWoke };
}

type CollectionResult = {
  indices: number[];
  win: number;
  collectorRoutes: CollectorRoute[];
  dragonEggsCollected: number;
  dragonEggIndices: number[];
};

/**
 * Resolves collector ownership and movement without mutating the board. Thin
 * Dragonforge-flavoured wrapper over the shared engine (see
 * engine/collection.ts for the actual BFS-pathfinding/claim-priority
 * algorithm) — this just translates the engine's generic "shared symbol"
 * result back into Dragonforge's Dragon Egg naming.
 */
export function resolveCollection(board: readonly BoardCell[], multiplier = 1): CollectionResult {
  const result = resolveCollectionEngine(board, COLLECTION_CONFIG, multiplier);
  return {
    indices: result.indices,
    win: result.win,
    // The engine's route.symbol is the broader SymbolType, but a route can only
    // ever originate at a collector cell (see COLLECTION_CONFIG.isCollector).
    collectorRoutes: result.collectorRoutes as CollectorRoute[],
    dragonEggsCollected: result.sharedSymbolsCollected,
    dragonEggIndices: result.sharedSymbolIndices
  };
}

/** Replaces the given cells in place and returns only the cells that changed. */
function refill(board: BoardCell[], indices: readonly number[], context: RoundContext, weights: readonly { symbol: SymbolType; weight: number }[]): CellChange[] {
  const changes: CellChange[] = [];
  for (const index of indices) {
    const previous = board[index];
    // Dragon Eggs are permanent once they have landed. Keep this defensive
    // guard here so no current or future caller can accidentally overwrite one.
    if (previous.symbol === "dragonEgg") continue;
    const symbol = pickSymbol(context.rng, weights);
    board[index] = createCell(previous.x, previous.y, symbol, context);
    changes.push({ x: previous.x, y: previous.y, symbol });
  }
  return changes;
}

/** Rerolls every replaceable cell onto the delve reel. Held collectors and persistent Dragon Eggs stay put. */
function rerollAll(board: BoardCell[], context: RoundContext): CellChange[] {
  const indices: number[] = [];
  for (let index = 0; index < board.length; index += 1) {
    const symbol = board[index].symbol;
    if (!isCollector(symbol) && symbol !== "dragonEgg") indices.push(index);
  }
  return refill(board, indices, context, DRAGONFORGE_CONFIG.bonusSymbolWeights);
}

/** One delve of drift: a handful of non-collector cells reroll onto the delve reel. */
function mutate(board: BoardCell[], context: RoundContext): CellChange[] {
  const { min, max } = DRAGONFORGE_CONFIG.delveRerollPerDelve;
  const count = context.rng.int(min, max);
  const indices: number[] = [];

  for (let attempt = 0; attempt < count; attempt += 1) {
    const index = context.rng.int(0, BOARD_SIZE - 1);
    if (isCollector(board[index].symbol) || board[index].symbol === "dragonEgg") continue; // held collectors and eggs persist
    if (indices.includes(index)) continue;
    indices.push(index);
  }

  return refill(board, indices, context, DRAGONFORGE_CONFIG.bonusSymbolWeights);
}

export function simulateDragonforge(runs: number, seedPrefix = "sim"): SimulationSummary {
  let totalPaid = 0;
  let totalUncapped = 0;
  let totalBase = 0;
  let totalBonus = 0;
  let hits = 0;
  let profitWins = 0;
  let deadBoards = 0;
  let bonuses = 0;
  let nearMisses = 0;
  let cascades = 0;
  let maxWinHits = 0;
  let highestUncappedWin = 0;
  let dragonWakes = 0;
  let totalDelves = 0;
  const wins = new Float64Array(runs);

  for (let index = 0; index < runs; index += 1) {
    const round = resolveDragonforgeRound({ seed: `${seedPrefix}-${index}`, stake: 1 });
    totalPaid += round.cappedWin;
    totalUncapped += round.uncappedWin;
    totalBase += round.baseWin;
    totalBonus += round.bonus?.bonusWin ?? 0;
    cascades += round.cascades;
    wins[index] = round.cappedWin;
    highestUncappedWin = Math.max(highestUncappedWin, round.uncappedWin);
    if (round.cappedWin > 0) hits += 1;
    if (round.cappedWin > 1) profitWins += 1;
    if (round.cappedWin === 0) deadBoards += 1;
    if (round.bonus) {
      bonuses += 1;
      totalDelves += round.bonus.delvesUsed;
      if (round.bonus.dragonWoke) dragonWakes += 1;
    }
    if (round.dragonEggsSeen === DRAGONFORGE_CONFIG.bonusTriggerEggs - 1 && !round.bonus) nearMisses += 1;
    if (round.capApplied) maxWinHits += 1;
  }

  wins.sort();
  const rtp = totalPaid / runs;
  const uncappedRtp = totalUncapped / runs;

  return {
    runs,
    rtp: roundRatio(rtp),
    uncappedRtp: roundRatio(uncappedRtp),
    baseRtp: roundRatio(totalBase / runs),
    bonusRtp: roundRatio(totalBonus / runs),
    houseEdge: roundRatio(1 - rtp),
    hitRate: roundRatio(hits / runs),
    profitWinRate: roundRatio(profitWins / runs),
    deadBoardRate: roundRatio(deadBoards / runs),
    bonusRate: roundRatio(bonuses / runs),
    nearMissRate: roundRatio(nearMisses / runs),
    averageCascades: roundRatio(cascades / runs),
    maxWinHits,
    highestUncappedWin: roundMoney(highestUncappedWin),
    capRtpRemoved: roundRatio(uncappedRtp - rtp),
    medianWin: roundMoney(percentile(wins, 0.5)),
    p95Win: roundMoney(percentile(wins, 0.95)),
    p99Win: roundMoney(percentile(wins, 0.99)),
    dragonWakeRate: roundRatio(bonuses > 0 ? dragonWakes / bonuses : 0),
    averageDelves: roundRatio(bonuses > 0 ? totalDelves / bonuses : 0)
  };
}

/**
 * Steps carry cell diffs rather than full boards, so the board state at each
 * step is rebuilt here by folding the diffs over `initialBoard`. Returns one
 * frame per step, `frames[i]` being the board immediately after `steps[i]`.
 */
export function buildFrames(round: DragonforgeRoundResult): BoardCell[][] {
  return buildFramesEngine(round.initialBoard, round.steps, width, (symbol) => DRAGONFORGE_CONFIG.symbolValues[symbol]);
}

/** Rebuilds a board state by applying replay diffs over the initial board. */
export function applyChanges(board: readonly BoardCell[], changes: readonly CellChange[]): BoardCell[] {
  return applyChangesEngine(board, changes, width, (symbol) => DRAGONFORGE_CONFIG.symbolValues[symbol]);
}

export function isAllowedStake(stake: unknown): stake is number {
  return typeof stake === "number" && Number.isFinite(stake) && (DRAGONFORGE_CONFIG.allowedStakes as readonly number[]).includes(stake);
}

function createBoard(context: RoundContext): BoardCell[] {
  const board: BoardCell[] = new Array(BOARD_SIZE);
  for (let y = 0; y < DRAGONFORGE_CONFIG.height; y += 1) {
    for (let x = 0; x < DRAGONFORGE_CONFIG.width; x += 1) {
      board[y * DRAGONFORGE_CONFIG.width + x] = createCell(x, y, pickSymbol(context.rng, DRAGONFORGE_CONFIG.symbolWeights), context);
    }
  }
  return board;
}

/**
 * Ids embed a per-round generation counter so that replacing a cell with the
 * same symbol still produces a new key and React remounts it.
 */
function createCell(x: number, y: number, symbol: SymbolType, context: RoundContext): BoardCell {
  context.gen += 1;
  return { id: `${x}-${y}-${symbol}-${context.gen}`, x, y, symbol, value: DRAGONFORGE_CONFIG.symbolValues[symbol] };
}

function countSymbols(board: readonly BoardCell[], symbol: SymbolType): number {
  let total = 0;
  for (const cell of board) if (cell.symbol === symbol) total += 1;
  return total;
}

function countCollectors(board: readonly BoardCell[]): number {
  let total = 0;
  for (const cell of board) if (isCollector(cell.symbol)) total += 1;
  return total;
}

function isCollector(symbol: SymbolType): symbol is CollectorType {
  return symbol === "miner" || symbol === "prospector" || symbol === "smith" || symbol === "scout";
}

function pickSymbol(rng: Rng, weights: readonly { symbol: SymbolType; weight: number }[]): SymbolType {
  return rng.pickWeighted(weights).symbol;
}

function cloneBoard(board: readonly BoardCell[]): BoardCell[] {
  return board.map((cell) => ({ ...cell }));
}

/**
 * Derived from the seed with its own hash stream, deliberately not from the
 * game RNG — otherwise changing the id format would change every outcome.
 */
function createRoundId(seed: string): string {
  const hash = xmur3(`round:${seed}`);
  return `df_${hash().toString(36)}${hash().toString(36)}`.slice(0, 24);
}
