export type SymbolType = "leaf" | "acorn" | "mushroom" | "bloom" | "root" | "rot" | "spiritSeed" | "fox" | "owl" | "stag" | "wisp";
export type CollectorType = Extract<SymbolType, "fox" | "owl" | "stag" | "wisp">;

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

export type WildwoodStepType =
  | "boardGenerated"
  | "symbolsCollected"
  | "cascade"
  | "bonusTriggered"
  | "bonusBreath"
  | "bonusEnded"
  | "roundEnded";

export type WildwoodStep = {
  type: WildwoodStepType;
  message: string;
  winDelta?: number;
  /** Cells whose symbol changed during this step. Apply in order over `initialBoard`. */
  changes?: CellChange[];
  /** Unique normal cells removed after every collector has completed its route. */
  collected?: Array<{ x: number; y: number }>;
  /** Persistent Spirit Seeds rewarded during this step. They are never removed. */
  spiritSeedsRewarded?: Array<{ x: number; y: number }>;
  /** Deterministic collector movement and ownership for replay animation. */
  collectorRoutes?: CollectorRoute[];
};

export type WildwoodBonusResult = {
  triggered: true;
  breathsUsed: number;
  bonusWin: number;
  peakMultiplier: number;
  collectorsHeld: number;
};

export type WildwoodRoundResult = {
  roundId: string;
  seed: string;
  stake: number;
  baseWin: number;
  uncappedWin: number;
  cappedWin: number;
  capApplied: boolean;
  initialBoard: BoardCell[];
  finalBoard: BoardCell[];
  bonus?: WildwoodBonusResult;
  spiritSeedsSeen: number;
  cascades: number;
  steps: WildwoodStep[];
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
};

export const WILDWOOD_CONFIG = {
  width: 6,
  height: 6,
  maxWin: 1000,
  maxBaseCascades: 6,
  bonusTriggerSeeds: 3,
  startingBonusBreaths: 3,
  maxBonusBreaths: 40,
  /** Stakes the server will accept. The client select must be a subset of this. */
  allowedStakes: [0.2, 0.5, 1, 2, 5] as const,
  /** Design target. `pnpm test` asserts the simulated RTP stays inside rtpTolerance of this. */
  targetRtp: 0.95,
  rtpTolerance: 0.01,

  /**
   * Global payout scalars, resolved numerically by `pnpm sim --tune`.
   * Changing any weight or value below invalidates these — re-run the tuner.
   */
  baseScalar: 0.82242,
  bonusScalar: 0.19019,

  /**
   * Base-game reel weights, summing to 100.
   * Collectors total 0.90 — this is the main hit-rate lever. Roughly
   * P(dead board) = (1 - 0.009)^36 = 72%.
   */
  symbolWeights: [
    { symbol: "leaf", weight: 29 },
    { symbol: "acorn", weight: 21 },
    { symbol: "mushroom", weight: 15 },
    { symbol: "bloom", weight: 8 },
    { symbol: "root", weight: 7 },
    { symbol: "rot", weight: 18.05 },
    { symbol: "spiritSeed", weight: 1.05 },
    { symbol: "fox", weight: 0.3 },
    { symbol: "owl", weight: 0.25 },
    { symbol: "stag", weight: 0.25 },
    { symbol: "wisp", weight: 0.1 }
  ] satisfies Array<{ symbol: SymbolType; weight: number }>,

  /**
   * Bonus reel weights. Richer in collectors and seeds than the base reel —
   * this is what drives the bonus tail toward the 1000x cap.
   */
  bonusSymbolWeights: [
    { symbol: "leaf", weight: 22 },
    { symbol: "acorn", weight: 18 },
    { symbol: "mushroom", weight: 15 },
    { symbol: "bloom", weight: 12 },
    { symbol: "root", weight: 10 },
    { symbol: "rot", weight: 9 },
    { symbol: "spiritSeed", weight: 8 },
    { symbol: "fox", weight: 2.2 },
    { symbol: "owl", weight: 1.6 },
    { symbol: "stag", weight: 1.6 },
    { symbol: "wisp", weight: 0.6 }
  ] satisfies Array<{ symbol: SymbolType; weight: number }>,

  symbolValues: {
    leaf: 0.025,
    acorn: 0.05,
    mushroom: 0.1,
    bloom: 0.25,
    root: 0.18,
    rot: 0,
    spiritSeed: 0.5,
    fox: 0,
    owl: 0,
    stag: 0,
    wisp: 0
  } satisfies Record<SymbolType, number>,

  collectorTargets: {
    fox: ["acorn", "mushroom", "leaf"],
    owl: ["spiritSeed", "root", "bloom"],
    stag: ["leaf", "bloom", "root"],
    wisp: ["leaf", "acorn", "mushroom", "bloom", "root", "spiritSeed"]
  } satisfies Record<CollectorType, SymbolType[]>,

  /** Per-collector payout multiplier. Rarer collectors with richer targets pay more. */
  collectorMultipliers: {
    fox: 1,
    stag: 1.5,
    owl: 2,
    wisp: 3
  } satisfies Record<CollectorType, number>,

  /** Applied to cascade N (1-indexed). Rewards chains without inflating the first hit. */
  cascadeMultipliers: [1, 1.3, 1.7, 2.2, 3, 4] as const,

  /** Cells rerolled per bonus breath. Drives how fast breaths decay. */
  bonusRerollPerBreath: { min: 4, max: 8 }
};

const { width, height } = WILDWOOD_CONFIG;
const BOARD_SIZE = width * height;

/** Precomputed adjacency, built once. Avoids the O(n^2) board scan per collector. */
const NEIGHBOUR_INDEX: readonly (readonly number[])[] = buildNeighbourIndex();

/** Precomputed target lookups, so collection is a Set hit rather than an array scan. */
const TARGET_SETS: Record<CollectorType, ReadonlySet<SymbolType>> = {
  fox: new Set(WILDWOOD_CONFIG.collectorTargets.fox),
  owl: new Set(WILDWOOD_CONFIG.collectorTargets.owl),
  stag: new Set(WILDWOOD_CONFIG.collectorTargets.stag),
  wisp: new Set(WILDWOOD_CONFIG.collectorTargets.wisp)
};

type Rng = {
  next: () => number;
  int: (minInclusive: number, maxInclusive: number) => number;
  chance: (probability: number) => boolean;
  pickWeighted: <T extends { weight: number }>(items: readonly T[]) => T;
};

/** Mutable per-round state. `gen` gives every produced cell a unique id for React keys. */
type RoundContext = {
  rng: Rng;
  gen: number;
};

export function resolveWildwoodRound(input: { seed: string; stake?: number }): WildwoodRoundResult {
  const stake = input.stake ?? 1;
  const context: RoundContext = { rng: createRng(input.seed), gen: 0 };
  const roundId = createRoundId(input.seed);
  const steps: WildwoodStep[] = [];

  const board = createBoard(context);
  const initialBoard = cloneBoard(board);
  let baseWin = 0;
  let cascades = 0;
  let spiritSeedsSeen = countSymbols(board, "spiritSeed");

  steps.push({ type: "boardGenerated", message: "Fresh 6×6 board generated." });

  for (let cascade = 1; cascade <= WILDWOOD_CONFIG.maxBaseCascades; cascade += 1) {
    const cascadeMultiplier = WILDWOOD_CONFIG.cascadeMultipliers[Math.min(cascade, WILDWOOD_CONFIG.cascadeMultipliers.length) - 1];
    const collection = resolveCollection(board, cascadeMultiplier * WILDWOOD_CONFIG.baseScalar);
    if (collection.collectorRoutes.length === 0) break;

    const rewardedTargets = collection.indices.length + collection.spiritSeedIndices.length;
    cascades += 1;
    baseWin += collection.win;
    steps.push({
      type: "symbolsCollected",
      message: `Cascade ${cascade}: collectors rewarded ${rewardedTargets} target${rewardedTargets === 1 ? "" : "s"} at ${cascadeMultiplier}x for ${formatWin(collection.win)}x.`,
      winDelta: collection.win,
      collected: collection.indices.map((index) => ({ x: board[index].x, y: board[index].y })),
      spiritSeedsRewarded: collection.spiritSeedIndices.map((index) => ({ x: board[index].x, y: board[index].y })),
      collectorRoutes: collection.collectorRoutes
    });

    // A persistent seed can pay on a turn, but it cannot create another turn by
    // itself because the board did not change.
    if (collection.indices.length === 0) break;

    // Refill only removed normal symbols. Spirit Seeds remain on the board.
    const changes = refill(board, collection.indices, context, WILDWOOD_CONFIG.symbolWeights);
    spiritSeedsSeen += changes.filter((change) => change.symbol === "spiritSeed").length;
    steps.push({ type: "cascade", message: `Cascade ${cascade}: the forest refilled.`, changes });
  }

  let bonusWin = 0;
  let bonus: WildwoodBonusResult | undefined;

  if (spiritSeedsSeen >= WILDWOOD_CONFIG.bonusTriggerSeeds) {
    steps.push({ type: "bonusTriggered", message: `${spiritSeedsSeen} Spirit Seeds seen. Wildwood bonus triggered.` });
    bonus = resolveBonus(board, context, steps);
    bonusWin = bonus.bonusWin;
  }

  const uncappedWin = roundMoney((baseWin + bonusWin) * stake);
  const cappedWin = roundMoney(Math.min(uncappedWin, WILDWOOD_CONFIG.maxWin * stake));
  const capApplied = uncappedWin > cappedWin;

  steps.push({
    type: "roundEnded",
    message: capApplied
      ? `Round ended at the ${WILDWOOD_CONFIG.maxWin}x cap. Uncapped potential was ${formatWin(uncappedWin / stake)}x.`
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
    spiritSeedsSeen,
    cascades,
    steps
  };
}

/**
 * Hold-and-win bonus.
 *
 * Collectors that land are held for the rest of the feature, and every held
 * collector collects on every subsequent breath. A new collector resets the
 * breath counter to 3. The global multiplier rises with each Spirit Seed
 * collected. Held collectors x rising multiplier is what produces the tail —
 * this is the only place in the game that can reach 1000x.
 */
function resolveBonus(board: BoardCell[], context: RoundContext, steps: WildwoodStep[]): WildwoodBonusResult {
  let breathsRemaining = WILDWOOD_CONFIG.startingBonusBreaths;
  let breathsUsed = 0;
  let bonusWin = 0;
  let multiplier = 1;

  // Seed the feature board so held collectors have somewhere to grow.
  const openingChanges = rerollAll(board, context);
  steps.push({ type: "bonusBreath", message: "The Wildwood opens. Collectors that land are held.", changes: openingChanges });

  while (breathsRemaining > 0 && breathsUsed < WILDWOOD_CONFIG.maxBonusBreaths) {
    breathsRemaining -= 1;
    breathsUsed += 1;

    const before = countCollectors(board);
    const mutationChanges = mutate(board, context);
    const gained = countCollectors(board) - before;

    const collection = resolveCollection(board, multiplier * WILDWOOD_CONFIG.bonusScalar);
    const seedsTaken = collection.spiritSeedsCollected;
    multiplier += seedsTaken;

    bonusWin += collection.win;
    const refillChanges = collection.indices.length > 0 ? refill(board, collection.indices, context, WILDWOOD_CONFIG.bonusSymbolWeights) : [];

    if (gained > 0) breathsRemaining = WILDWOOD_CONFIG.startingBonusBreaths;

    steps.push({
      type: "bonusBreath",
      message: `Breath ${breathsUsed}: ${gained > 0 ? `${gained} collector${gained > 1 ? "s" : ""} held, breaths reset.` : "the forest shifted."} Paid ${formatWin(collection.win)}x at ${multiplier}x. ${breathsRemaining} breaths remain.`,
      winDelta: collection.win,
      changes: [...mutationChanges, ...refillChanges],
      collected: collection.indices.map((index) => ({ x: board[index].x, y: board[index].y })),
      spiritSeedsRewarded: collection.spiritSeedIndices.map((index) => ({ x: board[index].x, y: board[index].y })),
      collectorRoutes: collection.collectorRoutes
    });
  }

  const roundedBonusWin = roundMoney(bonusWin);
  const collectorsHeld = countCollectors(board);
  steps.push({
    type: "bonusEnded",
    message: `Wildwood bonus ended after ${breathsUsed} breaths with ${collectorsHeld} collectors held for ${formatWin(roundedBonusWin)}x.`,
    winDelta: roundedBonusWin
  });

  return { triggered: true, breathsUsed, bonusWin: roundedBonusWin, peakMultiplier: multiplier, collectorsHeld };
}

type CollectionResult = {
  indices: number[];
  win: number;
  collectorRoutes: CollectorRoute[];
  spiritSeedsCollected: number;
  spiritSeedIndices: number[];
};

/**
 * Resolves collector ownership and movement without mutating the board.
 *
 * Each collector may only target applicable symbols that were adjacent to its
 * original position at the start of the collection phase. Collectors act in
 * board order. A normal symbol becomes an empty traversable cell as soon as it
 * is claimed, so later collectors cannot also receive its value. Spirit Seeds
 * remain available to every eligible collector and persist unchanged after the
 * collection phase, allowing them to pay again on a later cascade or breath.
 */
export function resolveCollection(board: readonly BoardCell[], multiplier = 1): CollectionResult {
  const claimedNormal = new Set<number>();
  const collectedIndices: number[] = [];
  const collectedSeedIndices = new Set<number>();
  const collectorRoutes: CollectorRoute[] = [];
  let rawWin = 0;

  for (let originIndex = 0; originIndex < board.length; originIndex += 1) {
    const collector = board[originIndex];
    if (!isCollector(collector.symbol)) continue;
    const collectorSymbol = collector.symbol;

    const eligibleTargets = new Set(
      NEIGHBOUR_INDEX[originIndex].filter((index) => TARGET_SETS[collectorSymbol].has(board[index].symbol))
    );
    if (eligibleTargets.size === 0) continue;

    const seedsCollectedByThisCollector = new Set<number>();
    const moves: CollectorRouteMove[] = [];
    let currentIndex = originIndex;

    while (true) {
      const path = findPathToNearestTarget({
        board,
        currentIndex,
        originIndex,
        collector: collector.symbol,
        eligibleTargets,
        claimedNormal,
        seedsCollectedByThisCollector
      });
      if (!path) break;

      const destination = path[path.length - 1];
      for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
        const cellIndex = path[pathIndex];
        const cell = board[cellIndex];
        const move: CollectorRouteMove = { x: cell.x, y: cell.y };
        if (cellIndex === destination) move.collect = true;
        moves.push(move);
      }

      const target = board[destination];
      if (target.symbol === "spiritSeed") {
        seedsCollectedByThisCollector.add(destination);
        collectedSeedIndices.add(destination);
      } else {
        claimedNormal.add(destination);
        collectedIndices.push(destination);
      }

      rawWin += target.value * WILDWOOD_CONFIG.collectorMultipliers[collector.symbol];
      currentIndex = destination;
    }

    if (moves.length > 0) {
      collectorRoutes.push({ x: collector.x, y: collector.y, symbol: collector.symbol, moves });
    }
  }

  return {
    indices: collectedIndices,
    win: roundMoney(rawWin * multiplier),
    collectorRoutes,
    spiritSeedsCollected: collectedSeedIndices.size,
    spiritSeedIndices: [...collectedSeedIndices]
  };
}

type PathSearchInput = {
  board: readonly BoardCell[];
  currentIndex: number;
  originIndex: number;
  collector: CollectorType;
  eligibleTargets: ReadonlySet<number>;
  claimedNormal: ReadonlySet<number>;
  seedsCollectedByThisCollector: ReadonlySet<number>;
};

/** Breadth-first search gives the shortest legal route and deterministic tie-breaking. */
function findPathToNearestTarget(input: PathSearchInput): number[] | null {
  const {
    board,
    currentIndex,
    originIndex,
    collector,
    eligibleTargets,
    claimedNormal,
    seedsCollectedByThisCollector
  } = input;
  const queue = [currentIndex];
  const parent = new Int16Array(BOARD_SIZE);
  parent.fill(-2);
  parent[currentIndex] = -1;
  let cursor = 0;

  while (cursor < queue.length) {
    const index = queue[cursor];
    cursor += 1;

    if (index !== currentIndex && isAvailableTarget(index)) {
      const path: number[] = [];
      let current = index;
      while (current !== -1) {
        path.push(current);
        current = parent[current];
      }
      path.reverse();
      return path;
    }

    for (const neighbour of NEIGHBOUR_INDEX[index]) {
      if (parent[neighbour] !== -2) continue;
      if (!isPassable(neighbour)) continue;
      parent[neighbour] = index;
      queue.push(neighbour);
    }
  }

  return null;

  function isAvailableTarget(index: number): boolean {
    if (!eligibleTargets.has(index)) return false;
    const symbol = board[index].symbol;
    if (!TARGET_SETS[collector].has(symbol)) return false;
    if (symbol === "spiritSeed") return !seedsCollectedByThisCollector.has(index);
    return !claimedNormal.has(index);
  }

  function isPassable(index: number): boolean {
    if (index === originIndex || claimedNormal.has(index)) return true;
    if (isAvailableTarget(index)) return true;
    return board[index].symbol === "spiritSeed" && seedsCollectedByThisCollector.has(index);
  }
}

/** Replaces the given cells in place and returns only the cells that changed. */
function refill(board: BoardCell[], indices: readonly number[], context: RoundContext, weights: readonly { symbol: SymbolType; weight: number }[]): CellChange[] {
  const changes: CellChange[] = [];
  for (const index of indices) {
    const previous = board[index];
    // Spirit Seeds are permanent once they have landed. Keep this defensive
    // guard here so no current or future caller can accidentally overwrite one.
    if (previous.symbol === "spiritSeed") continue;
    const symbol = pickSymbol(context.rng, weights);
    board[index] = createCell(previous.x, previous.y, symbol, context);
    changes.push({ x: previous.x, y: previous.y, symbol });
  }
  return changes;
}

/** Rerolls every replaceable cell onto the bonus reel. Held collectors and persistent Spirit Seeds stay put. */
function rerollAll(board: BoardCell[], context: RoundContext): CellChange[] {
  const indices: number[] = [];
  for (let index = 0; index < board.length; index += 1) {
    const symbol = board[index].symbol;
    if (!isCollector(symbol) && symbol !== "spiritSeed") indices.push(index);
  }
  return refill(board, indices, context, WILDWOOD_CONFIG.bonusSymbolWeights);
}

/** One breath of drift: a handful of non-collector cells reroll onto the bonus reel. */
function mutate(board: BoardCell[], context: RoundContext): CellChange[] {
  const { min, max } = WILDWOOD_CONFIG.bonusRerollPerBreath;
  const count = context.rng.int(min, max);
  const indices: number[] = [];

  for (let attempt = 0; attempt < count; attempt += 1) {
    const index = context.rng.int(0, BOARD_SIZE - 1);
    if (isCollector(board[index].symbol) || board[index].symbol === "spiritSeed") continue; // held collectors and seeds persist
    if (indices.includes(index)) continue;
    indices.push(index);
  }

  return refill(board, indices, context, WILDWOOD_CONFIG.bonusSymbolWeights);
}

export function simulateWildwood(runs: number, seedPrefix = "sim"): SimulationSummary {
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
  const wins = new Float64Array(runs);

  for (let index = 0; index < runs; index += 1) {
    const round = resolveWildwoodRound({ seed: `${seedPrefix}-${index}`, stake: 1 });
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
    if (round.bonus) bonuses += 1;
    if (round.spiritSeedsSeen === WILDWOOD_CONFIG.bonusTriggerSeeds - 1 && !round.bonus) nearMisses += 1;
    if (round.capApplied) maxWinHits += 1;
  }

  wins.sort();
  const percentile = (fraction: number) => wins[Math.min(runs - 1, Math.floor(fraction * runs))];
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
    medianWin: roundMoney(percentile(0.5)),
    p95Win: roundMoney(percentile(0.95)),
    p99Win: roundMoney(percentile(0.99))
  };
}

/**
 * Steps carry cell diffs rather than full boards, so the board state at each
 * step is rebuilt here by folding the diffs over `initialBoard`. Returns one
 * frame per step, `frames[i]` being the board immediately after `steps[i]`.
 */
export function buildFrames(round: WildwoodRoundResult): BoardCell[][] {
  const frames: BoardCell[][] = [];
  let board = round.initialBoard;
  for (const step of round.steps) {
    if (step.changes?.length) board = applyChanges(board, step.changes);
    frames.push(board);
  }
  return frames;
}

/** Rebuilds a board state by applying replay diffs over the initial board. */
export function applyChanges(board: readonly BoardCell[], changes: readonly CellChange[]): BoardCell[] {
  const next = cloneBoard(board);
  for (const change of changes) {
    const index = change.y * width + change.x;
    next[index] = {
      id: `${change.x}-${change.y}-${change.symbol}-${index}`,
      x: change.x,
      y: change.y,
      symbol: change.symbol,
      value: WILDWOOD_CONFIG.symbolValues[change.symbol]
    };
  }
  return next;
}

export function isAllowedStake(stake: unknown): stake is number {
  return typeof stake === "number" && Number.isFinite(stake) && (WILDWOOD_CONFIG.allowedStakes as readonly number[]).includes(stake);
}

function buildNeighbourIndex(): number[][] {
  const map: number[][] = [];
  for (let y = 0; y < WILDWOOD_CONFIG.height; y += 1) {
    for (let x = 0; x < WILDWOOD_CONFIG.width; x += 1) {
      const neighbours: number[] = [];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= WILDWOOD_CONFIG.width || ny >= WILDWOOD_CONFIG.height) continue;
          neighbours.push(ny * WILDWOOD_CONFIG.width + nx);
        }
      }
      map[y * WILDWOOD_CONFIG.width + x] = neighbours;
    }
  }
  return map;
}

function createBoard(context: RoundContext): BoardCell[] {
  const board: BoardCell[] = new Array(BOARD_SIZE);
  for (let y = 0; y < WILDWOOD_CONFIG.height; y += 1) {
    for (let x = 0; x < WILDWOOD_CONFIG.width; x += 1) {
      board[y * WILDWOOD_CONFIG.width + x] = createCell(x, y, pickSymbol(context.rng, WILDWOOD_CONFIG.symbolWeights), context);
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
  return { id: `${x}-${y}-${symbol}-${context.gen}`, x, y, symbol, value: WILDWOOD_CONFIG.symbolValues[symbol] };
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
  return symbol === "fox" || symbol === "owl" || symbol === "stag" || symbol === "wisp";
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
  return `ww_${hash().toString(36)}${hash().toString(36)}`.slice(0, 24);
}

function createRng(seed: string): Rng {
  const hash = xmur3(seed);
  const next = sfc32(hash(), hash(), hash(), hash());
  return {
    next,
    int(minInclusive, maxInclusive) {
      return Math.floor(next() * (maxInclusive - minInclusive + 1)) + minInclusive;
    },
    chance(probability) {
      return next() < probability;
    },
    pickWeighted(items) {
      let totalWeight = 0;
      for (const item of items) totalWeight += item.weight;
      let cursor = next() * totalWeight;
      for (const item of items) {
        cursor -= item.weight;
        if (cursor < 0) return item;
      }
      return items[items.length - 1];
    }
  };
}

function xmur3(input: string) {
  let hash = 1779033703 ^ input.length;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return function nextHash() {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^= hash >>> 16) >>> 0;
  };
}

function sfc32(a: number, b: number, c: number, d: number) {
  return function next() {
    a >>>= 0;
    b >>>= 0;
    c >>>= 0;
    d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const result = (t + d) | 0;
    c = (c + result) | 0;
    return (result >>> 0) / 4294967296;
  };
}

function roundMoney(value: number): number {
  return Number(value.toFixed(4));
}

function roundRatio(value: number): number {
  return Number(value.toFixed(6));
}

function formatWin(value: number): string {
  return roundMoney(value).toFixed(2);
}
