export type SymbolType = "leaf" | "acorn" | "mushroom" | "bloom" | "root" | "rot" | "spiritSeed" | "fox" | "owl" | "stag" | "wisp";
export type CollectorType = Extract<SymbolType, "fox" | "owl" | "stag" | "wisp">;

export type BoardCell = {
  id: string;
  x: number;
  y: number;
  symbol: SymbolType;
  value: number;
};

export type WildwoodStep = {
  type: "boardGenerated" | "symbolsCollected" | "cascade" | "bonusTriggered" | "bonusBreath" | "bonusEnded" | "roundEnded";
  message: string;
  winDelta?: number;
  board?: BoardCell[];
};

export type WildwoodBonusResult = {
  triggered: true;
  breathsUsed: number;
  bonusWin: number;
  finalBoard: BoardCell[];
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
};

export const WILDWOOD_CONFIG = {
  width: 6,
  height: 6,
  maxWin: 1000,
  maxBaseCascades: 5,
  startingBonusBreaths: 3,
  maxBonusBreaths: 12,
  bonusTriggerSeeds: 3,
  symbolWeights: [
    { symbol: "leaf", weight: 27 },
    { symbol: "acorn", weight: 18 },
    { symbol: "mushroom", weight: 14 },
    { symbol: "bloom", weight: 7 },
    { symbol: "root", weight: 6 },
    { symbol: "rot", weight: 5 },
    { symbol: "spiritSeed", weight: 2.2 },
    { symbol: "fox", weight: 5.5 },
    { symbol: "owl", weight: 5.5 },
    { symbol: "stag", weight: 5.5 },
    { symbol: "wisp", weight: 4.3 }
  ] satisfies Array<{ symbol: SymbolType; weight: number }>,
  symbolValues: {
    leaf: 0.015,
    acorn: 0.025,
    mushroom: 0.045,
    bloom: 0.11,
    root: 0.08,
    rot: 0,
    spiritSeed: 0.18,
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
  } satisfies Record<CollectorType, SymbolType[]>
};

type Rng = {
  next: () => number;
  int: (minInclusive: number, maxInclusive: number) => number;
  chance: (probability: number) => boolean;
  pickWeighted: <T extends { weight: number }>(items: readonly T[]) => T;
};

export function resolveWildwoodRound(input: { seed: string; stake?: number }): WildwoodRoundResult {
  const stake = input.stake ?? 1;
  const rng = createRng(input.seed);
  const roundId = `ww_${input.seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}_${Math.floor(rng.next() * 1_000_000)}`;
  const steps: WildwoodStep[] = [];
  let board = createBoard(rng);
  const initialBoard = cloneBoard(board);
  let baseWin = 0;
  let cascades = 0;
  let spiritSeedsSeen = countSymbols(board, "spiritSeed");

  steps.push({ type: "boardGenerated", message: "Fresh 6×6 board generated.", board: cloneBoard(board) });

  for (let cascade = 1; cascade <= WILDWOOD_CONFIG.maxBaseCascades; cascade += 1) {
    const collection = collectBoard(board, 1 + cascade * 0.08);
    if (collection.cells.length === 0) break;

    cascades += 1;
    baseWin += collection.win;
    spiritSeedsSeen += collection.cells.filter((cell) => cell.symbol === "spiritSeed").length;
    steps.push({ type: "symbolsCollected", message: `Cascade ${cascade}: collectors gathered ${collection.cells.length} symbols for ${formatWin(collection.win)}x.`, winDelta: collection.win, board: cloneBoard(board) });

    board = replaceCells(board, collection.cells, rng);
    steps.push({ type: "cascade", message: `Cascade ${cascade}: the forest refilled.`, board: cloneBoard(board) });
  }

  let bonusWin = 0;
  let bonus: WildwoodBonusResult | undefined;

  if (spiritSeedsSeen >= WILDWOOD_CONFIG.bonusTriggerSeeds) {
    steps.push({ type: "bonusTriggered", message: `${spiritSeedsSeen} Spirit Seeds seen. Wildwood bonus triggered.`, board: cloneBoard(board) });
    bonus = resolveBonus(board, rng, steps);
    bonusWin = bonus.bonusWin;
    board = bonus.finalBoard;
  }

  const uncappedWin = roundMoney((baseWin + bonusWin) * stake);
  const cappedWin = roundMoney(Math.min(uncappedWin, WILDWOOD_CONFIG.maxWin * stake));
  const capApplied = uncappedWin > cappedWin;

  steps.push({
    type: "roundEnded",
    message: capApplied ? `Round ended at the ${WILDWOOD_CONFIG.maxWin}x cap. Uncapped potential was ${formatWin(uncappedWin / stake)}x.` : `Round ended with ${formatWin(cappedWin / stake)}x paid.`,
    winDelta: cappedWin,
    board: cloneBoard(board)
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

export function simulateWildwood(runs: number): SimulationSummary {
  let totalPaid = 0;
  let totalUncapped = 0;
  let hits = 0;
  let profitWins = 0;
  let deadBoards = 0;
  let bonuses = 0;
  let nearMisses = 0;
  let cascades = 0;
  let maxWinHits = 0;
  let highestUncappedWin = 0;

  for (let index = 0; index < runs; index += 1) {
    const round = resolveWildwoodRound({ seed: `sim-${index}`, stake: 1 });
    totalPaid += round.cappedWin;
    totalUncapped += round.uncappedWin;
    cascades += round.cascades;
    highestUncappedWin = Math.max(highestUncappedWin, round.uncappedWin);
    if (round.cappedWin > 0) hits += 1;
    if (round.cappedWin > 1) profitWins += 1;
    if (round.cappedWin === 0) deadBoards += 1;
    if (round.bonus) bonuses += 1;
    if (round.spiritSeedsSeen === WILDWOOD_CONFIG.bonusTriggerSeeds - 1 && !round.bonus) nearMisses += 1;
    if (round.capApplied) maxWinHits += 1;
  }

  const rtp = totalPaid / runs;
  const uncappedRtp = totalUncapped / runs;

  return {
    runs,
    rtp: roundRatio(rtp),
    uncappedRtp: roundRatio(uncappedRtp),
    houseEdge: roundRatio(1 - rtp),
    hitRate: roundRatio(hits / runs),
    profitWinRate: roundRatio(profitWins / runs),
    deadBoardRate: roundRatio(deadBoards / runs),
    bonusRate: roundRatio(bonuses / runs),
    nearMissRate: roundRatio(nearMisses / runs),
    averageCascades: roundRatio(cascades / runs),
    maxWinHits,
    highestUncappedWin: roundMoney(highestUncappedWin),
    capRtpRemoved: roundRatio(uncappedRtp - rtp)
  };
}

function resolveBonus(startingBoard: BoardCell[], rng: Rng, steps: WildwoodStep[]): WildwoodBonusResult {
  let board = cloneBoard(startingBoard);
  let breathsRemaining = WILDWOOD_CONFIG.startingBonusBreaths;
  let breathsUsed = 0;
  let bonusWin = 0;
  let bonusMultiplier = 2.2;

  while (breathsRemaining > 0 && breathsUsed < WILDWOOD_CONFIG.maxBonusBreaths) {
    breathsRemaining -= 1;
    breathsUsed += 1;
    const breath = applyBonusBreath(board, rng);
    board = breath.board;
    bonusMultiplier += breath.multiplierBoost;
    const collection = collectBoard(board, bonusMultiplier);
    const winDelta = roundMoney(collection.win + breath.instantWin);
    bonusWin += winDelta;
    if (collection.cells.length > 0) board = replaceCells(board, collection.cells, rng);
    if (breath.extraBreath) breathsRemaining += 1;
    steps.push({ type: "bonusBreath", message: `Bonus breath ${breathsUsed}: ${breath.message} Paid ${formatWin(winDelta)}x. ${breathsRemaining} breaths remain.`, winDelta, board: cloneBoard(board) });
  }

  const roundedBonusWin = roundMoney(bonusWin);
  steps.push({ type: "bonusEnded", message: `Wildwood bonus ended after ${breathsUsed} breaths for ${formatWin(roundedBonusWin)}x.`, winDelta: roundedBonusWin, board: cloneBoard(board) });
  return { triggered: true, breathsUsed, bonusWin: roundedBonusWin, finalBoard: cloneBoard(board) };
}

function applyBonusBreath(board: BoardCell[], rng: Rng) {
  const mutationCount = rng.int(2, 5);
  let nextBoard = cloneBoard(board);
  let instantWin = 0;
  let multiplierBoost = 0;
  let message = "The forest shifted.";

  for (let index = 0; index < mutationCount; index += 1) {
    const target = nextBoard[rng.int(0, nextBoard.length - 1)];
    const roll = rng.next();
    if (roll < 0.25) {
      nextBoard = replaceOne(nextBoard, target, createCell(target.x, target.y, "bloom"));
      multiplierBoost += 0.2;
      message = "Bloom upgrades spread through the board.";
    } else if (roll < 0.5) {
      nextBoard = replaceOne(nextBoard, target, createCell(target.x, target.y, "root"));
      multiplierBoost += 0.12;
      message = "Ancient roots connected new paths.";
    } else if (roll < 0.68) {
      nextBoard = replaceOne(nextBoard, target, createCell(target.x, target.y, "spiritSeed"));
      instantWin += 0.25;
      message = "A Spirit Seed burst from the soil.";
    } else if (roll < 0.86) {
      nextBoard = replaceOne(nextBoard, target, createCell(target.x, target.y, pickSymbol(rng)));
      message = "Rot cleared and revealed fresh growth.";
    } else {
      const collectors: CollectorType[] = ["fox", "owl", "stag", "wisp"];
      nextBoard = replaceOne(nextBoard, target, createCell(target.x, target.y, collectors[rng.int(0, collectors.length - 1)]));
      multiplierBoost += 0.3;
      message = "A collector joined the Wildwood.";
    }
  }

  return { board: nextBoard, instantWin: roundMoney(instantWin), multiplierBoost, extraBreath: rng.chance(0.18), message };
}

function collectBoard(board: BoardCell[], multiplier: number) {
  const cells: BoardCell[] = [];
  let win = 0;
  for (const collector of board.filter((cell) => isCollector(cell.symbol))) {
    const targets = WILDWOOD_CONFIG.collectorTargets[collector.symbol];
    const nearby = neighbours(board, collector).filter((cell) => targets.includes(cell.symbol));
    if (nearby.length > 0) win += 0.01 * nearby.length;
    for (const cell of nearby) {
      if (cells.some((existing) => existing.x === cell.x && existing.y === cell.y)) continue;
      cells.push(cell);
      win += cell.value * multiplier;
    }
  }
  return { cells, win: roundMoney(win) };
}

function createBoard(rng: Rng): BoardCell[] {
  const board: BoardCell[] = [];
  for (let y = 0; y < WILDWOOD_CONFIG.height; y += 1) {
    for (let x = 0; x < WILDWOOD_CONFIG.width; x += 1) {
      board.push(createCell(x, y, pickSymbol(rng)));
    }
  }
  return board;
}

function createCell(x: number, y: number, symbol: SymbolType): BoardCell {
  return { id: `${x}-${y}-${symbol}`, x, y, symbol, value: WILDWOOD_CONFIG.symbolValues[symbol] };
}

function replaceCells(board: BoardCell[], cellsToReplace: BoardCell[], rng: Rng): BoardCell[] {
  const replaceSet = new Set(cellsToReplace.map((cell) => `${cell.x}:${cell.y}`));
  return board.map((cell) => (replaceSet.has(`${cell.x}:${cell.y}`) ? createCell(cell.x, cell.y, pickSymbol(rng)) : cell));
}

function replaceOne(board: BoardCell[], previous: BoardCell, next: BoardCell): BoardCell[] {
  return board.map((cell) => (cell.x === previous.x && cell.y === previous.y ? next : cell));
}

function neighbours(board: BoardCell[], cell: BoardCell): BoardCell[] {
  return board.filter((candidate) => Math.abs(candidate.x - cell.x) <= 1 && Math.abs(candidate.y - cell.y) <= 1 && !(candidate.x === cell.x && candidate.y === cell.y));
}

function countSymbols(board: BoardCell[], symbol: SymbolType): number {
  return board.filter((cell) => cell.symbol === symbol).length;
}

function isCollector(symbol: SymbolType): symbol is CollectorType {
  return symbol === "fox" || symbol === "owl" || symbol === "stag" || symbol === "wisp";
}

function pickSymbol(rng: Rng): SymbolType {
  return rng.pickWeighted(WILDWOOD_CONFIG.symbolWeights).symbol;
}

function cloneBoard(board: BoardCell[]): BoardCell[] {
  return board.map((cell) => ({ ...cell }));
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
      const totalWeight = items.reduce((total, item) => total + item.weight, 0);
      let cursor = next() * totalWeight;
      for (const item of items) {
        cursor -= item.weight;
        if (cursor <= 0) return item;
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
