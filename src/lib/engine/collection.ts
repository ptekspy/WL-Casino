import { roundMoney } from "./money";

/**
 * The collector-movement/claim engine shared by every game: collectors search
 * their neighbours for a matching target, path to the nearest one (BFS
 * through already-cleared cells), claim it, and repeat until nothing's left
 * in reach. Generalized out of wildwood.ts's `resolveCollection` — the
 * algorithm never actually cared about Wildwood's specific symbol names, only
 * about whichever target-sets/multipliers/board it was given, so this is a
 * pure extraction with no behavior change (see wildwood.test.ts).
 *
 * One symbol per game is treated as "shared": collectible by every eligible
 * collector rather than claimed exclusively, and never removed from the
 * board (Wildwood's Spirit Seed, Dragonforge's Dragon Egg). That's what lets
 * it persist across cascades/breaths and accumulate toward a bonus trigger.
 */
export type EngineBoardCell<TSymbol extends string> = {
  id: string;
  x: number;
  y: number;
  symbol: TSymbol;
  value: number;
};

export type EngineCellChange<TSymbol extends string> = {
  x: number;
  y: number;
  symbol: TSymbol;
};

/** One adjacent movement made by a collector. `collect` marks an impact at the destination. */
export type EngineCollectorRouteMove = {
  x: number;
  y: number;
  collect?: true;
};

/** Server-authored collection movement for one collector, in board-index-agnostic (x,y) form for replay. */
export type EngineCollectorRoute<TSymbol extends string> = {
  x: number;
  y: number;
  symbol: TSymbol;
  moves: EngineCollectorRouteMove[];
};

export type CollectionEngineConfig<TSymbol extends string> = {
  /** Precomputed via buildNeighbourIndex(width, height) — build once per game, reuse across rounds. */
  neighbourIndex: readonly (readonly number[])[];
  isCollector: (symbol: TSymbol) => boolean;
  targetsFor: (collector: TSymbol) => ReadonlySet<TSymbol>;
  multiplierFor: (collector: TSymbol) => number;
  /** The persistent, multi-claimable symbol (Spirit Seed / Dragon Egg). */
  sharedSymbol: TSymbol;
};

export type CollectionResult<TSymbol extends string> = {
  indices: number[];
  win: number;
  collectorRoutes: EngineCollectorRoute<TSymbol>[];
  sharedSymbolsCollected: number;
  sharedSymbolIndices: number[];
};

/**
 * Resolves collector ownership and movement without mutating the board.
 *
 * Each collector may only target applicable symbols that were adjacent to its
 * original position at the start of the collection phase. Collectors act in
 * descending payout-multiplier order (config.multiplierFor; board order
 * breaks ties) so that when two collectors could reach the same normal
 * symbol, the higher-paying one gets first pick. A normal symbol becomes an
 * empty traversable cell as soon as it is claimed, so later collectors cannot
 * also receive its value. The shared symbol remains available to every
 * eligible collector and persists unchanged after the collection phase.
 */
export function resolveCollection<TSymbol extends string>(
  board: readonly EngineBoardCell<TSymbol>[],
  config: CollectionEngineConfig<TSymbol>,
  multiplier = 1
): CollectionResult<TSymbol> {
  const { neighbourIndex, isCollector, targetsFor, multiplierFor, sharedSymbol } = config;
  const claimedNormal = new Set<number>();
  const collectedIndices: number[] = [];
  const collectedSharedIndices = new Set<number>();
  const collectorRoutes: EngineCollectorRoute<TSymbol>[] = [];
  let rawWin = 0;

  for (const originIndex of collectorIndicesByPriority(board, isCollector, multiplierFor)) {
    const collector = board[originIndex];
    const collectorSymbol = collector.symbol;
    const targets = targetsFor(collectorSymbol);

    const eligibleTargets = new Set(neighbourIndex[originIndex].filter((index) => targets.has(board[index].symbol)));
    if (eligibleTargets.size === 0) continue;

    const sharedCollectedByThisCollector = new Set<number>();
    const moves: EngineCollectorRouteMove[] = [];
    let currentIndex = originIndex;

    while (true) {
      const path = findPathToNearestTarget({
        board,
        neighbourIndex,
        currentIndex,
        originIndex,
        targets,
        sharedSymbol,
        eligibleTargets,
        claimedNormal,
        sharedCollectedByThisCollector
      });
      if (!path) break;

      const destination = path[path.length - 1];
      for (let pathIndex = 1; pathIndex < path.length; pathIndex += 1) {
        const cellIndex = path[pathIndex];
        const cell = board[cellIndex];
        const move: EngineCollectorRouteMove = { x: cell.x, y: cell.y };
        if (cellIndex === destination) move.collect = true;
        moves.push(move);
      }

      const target = board[destination];
      if (target.symbol === sharedSymbol) {
        sharedCollectedByThisCollector.add(destination);
        collectedSharedIndices.add(destination);
      } else {
        claimedNormal.add(destination);
        collectedIndices.push(destination);
      }

      rawWin += target.value * multiplierFor(collectorSymbol);
      currentIndex = destination;
    }

    if (moves.length > 0) {
      collectorRoutes.push({ x: collector.x, y: collector.y, symbol: collectorSymbol, moves });
    }
  }

  return {
    indices: collectedIndices,
    win: roundMoney(rawWin * multiplier),
    collectorRoutes,
    sharedSymbolsCollected: collectedSharedIndices.size,
    sharedSymbolIndices: [...collectedSharedIndices]
  };
}

/** Collector board indices, highest payout multiplier first (board order breaks ties). */
function collectorIndicesByPriority<TSymbol extends string>(
  board: readonly EngineBoardCell<TSymbol>[],
  isCollector: (symbol: TSymbol) => boolean,
  multiplierFor: (collector: TSymbol) => number
): number[] {
  const indices: number[] = [];
  for (let index = 0; index < board.length; index += 1) {
    if (isCollector(board[index].symbol)) indices.push(index);
  }
  return indices.sort((a, b) => multiplierFor(board[b].symbol) - multiplierFor(board[a].symbol));
}

type PathSearchInput<TSymbol extends string> = {
  board: readonly EngineBoardCell<TSymbol>[];
  neighbourIndex: readonly (readonly number[])[];
  currentIndex: number;
  originIndex: number;
  targets: ReadonlySet<TSymbol>;
  sharedSymbol: TSymbol;
  eligibleTargets: ReadonlySet<number>;
  claimedNormal: ReadonlySet<number>;
  sharedCollectedByThisCollector: ReadonlySet<number>;
};

/** Breadth-first search gives the shortest legal route and deterministic tie-breaking. */
function findPathToNearestTarget<TSymbol extends string>(input: PathSearchInput<TSymbol>): number[] | null {
  const {
    board,
    neighbourIndex,
    currentIndex,
    originIndex,
    targets,
    sharedSymbol,
    eligibleTargets,
    claimedNormal,
    sharedCollectedByThisCollector
  } = input;
  const queue = [currentIndex];
  const parent = new Int16Array(board.length);
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

    for (const neighbour of neighbourIndex[index]) {
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
    if (!targets.has(symbol)) return false;
    if (symbol === sharedSymbol) return !sharedCollectedByThisCollector.has(index);
    return !claimedNormal.has(index);
  }

  function isPassable(index: number): boolean {
    if (index === originIndex || claimedNormal.has(index)) return true;
    if (isAvailableTarget(index)) return true;
    return board[index].symbol === sharedSymbol && sharedCollectedByThisCollector.has(index);
  }
}
