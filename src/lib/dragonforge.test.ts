import { beforeAll, describe, expect, it } from "vitest";
import type { BoardCell, SymbolType } from "./dragonforge";
import {
  DRAGONFORGE_CONFIG,
  applyChanges,
  getCascadeValueMultiplier,
  getDragonState,
  getScaledCollectableValue,
  isAllowedStake,
  resolveCollection,
  resolveDragonforgeRound,
  simulateDragonforge
} from "./dragonforge";

/**
 * Sample size for the math guards. `simulateDragonforge` is deterministic for
 * a given seed prefix, so these assertions never flake — but they are still a
 * sample, and the Hoard is heavy-tailed. At 200k rounds the batch-to-batch
 * spread of total RTP is about ±1.4pp, mirroring Wildwood's math-test note —
 * see wildwood.test.ts.
 *
 * Persistent Dragon Eggs materially affect both cascade and bonus tails.
 * Re-run `pnpm sim -- --game dragonforge --tune` after changing their
 * lifecycle, any weight, any symbol value, or the delve-wake curve, then
 * validate the resolved scalars over a larger sample.
 */
const MATH_RUNS = 200_000;
const MATH_TIMEOUT = 60_000;

describe("Dragonforge engine", () => {
  it("resolves deterministic rounds from a seed", () => {
    const first = resolveDragonforgeRound({ seed: "same-seed", stake: 1 });
    const second = resolveDragonforgeRound({ seed: "same-seed", stake: 1 });
    expect(first).toEqual(second);
  });

  it("generates a 6x6 board", () => {
    const round = resolveDragonforgeRound({ seed: "board-size", stake: 1 });
    expect(round.initialBoard).toHaveLength(DRAGONFORGE_CONFIG.width * DRAGONFORGE_CONFIG.height);
  });

  it("derives roundId without consuming the game RNG stream", () => {
    const round = resolveDragonforgeRound({ seed: "id-stability", stake: 1 });
    expect(round.roundId).toMatch(/^df_[0-9a-z]+$/);
    expect(round.roundId).toBe(resolveDragonforgeRound({ seed: "id-stability", stake: 1 }).roundId);
  });

  it("gives every produced cell a unique id so React remounts on replacement", () => {
    for (let index = 0; index < 200; index += 1) {
      const round = resolveDragonforgeRound({ seed: `ids-${index}`, stake: 1 });
      const ids = round.initialBoard.map((cell) => cell.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("tracks uncapped win while enforcing the 1000x cap", () => {
    for (let index = 0; index < 500; index += 1) {
      const round = resolveDragonforgeRound({ seed: `cap-${index}`, stake: 2 });
      expect(round.cappedWin).toBeLessThanOrEqual(DRAGONFORGE_CONFIG.maxWin * 2);
      expect(round.uncappedWin).toBeGreaterThanOrEqual(round.cappedWin);
    }
  });

  it("increases collectable values by 50% per cascade", () => {
    expect(DRAGONFORGE_CONFIG.cascadeMultipliers).toEqual([1, 1.5, 2, 2.5, 3, 3.5]);
    expect(getCascadeValueMultiplier(1)).toBe(1);
    expect(getCascadeValueMultiplier(4)).toBe(2.5);
    expect(getCascadeValueMultiplier(99)).toBe(3.5);
    expect(getScaledCollectableValue("stone", getCascadeValueMultiplier(2))).toBeCloseTo(0.03, 6);
  });

  it("maps cascade count to a presentation-only dragon state", () => {
    expect(getDragonState(0)).toBe("sleeping");
    expect(getDragonState(1)).toBe("stirring");
    expect(getDragonState(2)).toBe("stirring");
    expect(getDragonState(3)).toBe("alert");
    expect(getDragonState(4)).toBe("alert");
    expect(getDragonState(5)).toBe("awake");
    expect(getDragonState(99)).toBe("awake");
  });

  it("only accepts configured stakes", () => {
    for (const stake of DRAGONFORGE_CONFIG.allowedStakes) expect(isAllowedStake(stake)).toBe(true);
    for (const stake of [0, -1, 0.3, 10, 1e12, Number.NaN, Number.POSITIVE_INFINITY, "1", null, undefined]) {
      expect(isAllowedStake(stake)).toBe(false);
    }
  });
});

function buildTestBoard(entries: Array<{ x: number; y: number; symbol: SymbolType }>): BoardCell[] {
  const byCoordinate = new Map(entries.map((entry) => [`${entry.x}:${entry.y}`, entry.symbol]));
  const board: BoardCell[] = [];
  for (let y = 0; y < DRAGONFORGE_CONFIG.height; y += 1) {
    for (let x = 0; x < DRAGONFORGE_CONFIG.width; x += 1) {
      const symbol = byCoordinate.get(`${x}:${y}`) ?? "unstableRock";
      board.push({ id: `${x}-${y}-${symbol}`, x, y, symbol, value: DRAGONFORGE_CONFIG.symbolValues[symbol] });
    }
  }
  return board;
}

describe("collector routes", () => {
  it("lets only one collector claim an overlapping normal symbol, favouring the higher multiplier", () => {
    const board = buildTestBoard([
      { x: 0, y: 0, symbol: "miner" },
      { x: 1, y: 0, symbol: "iron" },
      { x: 2, y: 0, symbol: "prospector" }
    ]);

    const collection = resolveCollection(board);

    // prospector (1.5x) outranks miner (1x), so it claims the contested iron even though miner is first in board order.
    expect(collection.indices).toEqual([1]);
    expect(collection.win).toBeCloseTo(DRAGONFORGE_CONFIG.symbolValues.iron * DRAGONFORGE_CONFIG.collectorMultipliers.prospector, 6);
    expect(collection.collectorRoutes).toHaveLength(1);
    expect(collection.collectorRoutes[0].symbol).toBe("prospector");
  });

  it("resolves a three-way contest (miner, prospector, scout all reach one iron) in favour of scout", () => {
    const board = buildTestBoard([
      { x: 1, y: 1, symbol: "miner" },
      { x: 3, y: 1, symbol: "prospector" },
      { x: 1, y: 3, symbol: "scout" },
      { x: 2, y: 2, symbol: "iron" }
    ]);

    const collection = resolveCollection(board);

    expect(collection.win).toBeCloseTo(DRAGONFORGE_CONFIG.symbolValues.iron * DRAGONFORGE_CONFIG.collectorMultipliers.scout, 6);
    expect(collection.collectorRoutes).toHaveLength(1);
    expect(collection.collectorRoutes[0].symbol).toBe("scout");
  });

  it("keeps a Dragon Egg available to every applicable collector", () => {
    const board = buildTestBoard([
      { x: 0, y: 0, symbol: "scout" },
      { x: 1, y: 0, symbol: "dragonEgg" },
      { x: 2, y: 0, symbol: "scout" }
    ]);

    const collection = resolveCollection(board);

    expect(collection.indices).toEqual([]);
    expect(collection.dragonEggsCollected).toBe(1);
    expect(collection.dragonEggIndices).toEqual([1]);
    expect(board[1].symbol).toBe("dragonEgg");
    expect(collection.collectorRoutes.map((route) => route.symbol)).toEqual(["scout", "scout"]);
    expect(collection.win).toBe(DRAGONFORGE_CONFIG.symbolValues.dragonEgg * DRAGONFORGE_CONFIG.collectorMultipliers.scout * 2);
  });

  it("allows only Dragon Eggs to be claimed by multiple collectors", () => {
    const collectableSymbols: SymbolType[] = ["stone", "iron", "gold", "gem", "relic", "dragonEgg"];
    const collectorPositions = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 2 }
    ];
    const collectorTypes = ["miner", "prospector", "smith", "scout"] as const;

    for (const symbol of collectableSymbols) {
      const applicableCollectors = collectorTypes.filter((collector) =>
        (DRAGONFORGE_CONFIG.collectorTargets[collector] as readonly SymbolType[]).includes(symbol)
      );
      const board = buildTestBoard([
        { x: 2, y: 2, symbol },
        ...applicableCollectors.map((collector, index) => ({ ...collectorPositions[index], symbol: collector }))
      ]);

      const collection = resolveCollection(board);
      const claimers = collection.collectorRoutes
        .filter((route) => route.moves.some((move) => move.collect && move.x === 2 && move.y === 2))
        .map((route) => route.symbol);

      if (symbol === "dragonEgg") {
        expect(new Set(claimers).size).toBe(applicableCollectors.length);
        expect(collection.indices).not.toContain(2 * DRAGONFORGE_CONFIG.width + 2);
      } else {
        expect(claimers).toHaveLength(1);
        expect(collection.indices).toContain(2 * DRAGONFORGE_CONFIG.width + 2);
      }
    }
  });

  it("only routes through the origin, already-cleared cells, or collectable targets", () => {
    const board = buildTestBoard([
      { x: 1, y: 1, symbol: "miner" },
      { x: 2, y: 1, symbol: "stone" },
      { x: 1, y: 2, symbol: "iron" },
      { x: 2, y: 2, symbol: "unstableRock" }
    ]);

    const [route] = resolveCollection(board).collectorRoutes;
    expect(route.moves.filter((move) => move.collect)).toHaveLength(2);

    let previous = { x: route.x, y: route.y };
    for (const move of route.moves) {
      expect(Math.max(Math.abs(move.x - previous.x), Math.abs(move.y - previous.y))).toBe(1);
      const symbol = board[move.y * DRAGONFORGE_CONFIG.width + move.x].symbol;
      if (symbol === "unstableRock") expect(move).not.toHaveProperty("collect");
      previous = move;
    }
  });
});

describe("replay steps", () => {
  it("carries diffs rather than full board clones", () => {
    const round = resolveDragonforgeRound({ seed: "diff-shape", stake: 1 });
    for (const step of round.steps) {
      expect(step).not.toHaveProperty("board");
      if (step.changes) expect(step.changes.length).toBeLessThanOrEqual(DRAGONFORGE_CONFIG.width * DRAGONFORGE_CONFIG.height);
    }
  });

  it("reconstructs the final board by replaying diffs over the initial board", () => {
    let bonusesCovered = 0;
    for (let index = 0; index < 400; index += 1) {
      const round = resolveDragonforgeRound({ seed: `replay-${index}`, stake: 1 });
      if (round.bonus) bonusesCovered += 1;

      let board = round.initialBoard;
      for (const step of round.steps) {
        if (step.changes) board = applyChanges(board, step.changes);
      }

      expect(board.map((cell) => cell.symbol)).toEqual(round.finalBoard.map((cell) => cell.symbol));
    }
    // Make sure the loop above actually exercised the bonus path.
    expect(bonusesCovered).toBeGreaterThan(0);
  });

  it("keeps a dead board close to the wire minimum", () => {
    const dead = resolveDragonforgeRound({ seed: "size-1", stake: 1 });
    expect(dead.cascades).toBe(0);
    expect(dead.steps.every((step) => !step.changes?.length)).toBe(true);
  });
});

describe("Dragonforge math", () => {
  let summary: ReturnType<typeof simulateDragonforge>;

  beforeAll(() => {
    summary = simulateDragonforge(MATH_RUNS);
  }, MATH_TIMEOUT);

  it(
    "returns RTP inside the design band",
    () => {
      expect(summary.rtp).toBeGreaterThan(0.9);
      expect(summary.rtp).toBeLessThan(1);
    },
    MATH_TIMEOUT
  );

  it(
    "triggers the Hoard at a plausible rate",
    () => {
      expect(summary.bonusRate).toBeGreaterThan(0.002);
      expect(summary.bonusRate).toBeLessThan(0.02);
    },
    MATH_TIMEOUT
  );

  it(
    "lets the dragon wake on most Hoards — the escalating wake chance is the actual risk mechanic",
    () => {
      // maxDelves is a safety net, not the expected ending: by the time wake
      // chance hits its 0.6 ceiling (delve ~12), surviving to delve 30 without
      // waking is astronomically unlikely, so waking should dominate.
      expect(summary.dragonWakeRate).toBeGreaterThan(0.5);
    },
    MATH_TIMEOUT
  );

  it(
    "leaves the 1000x cap reachable but rare",
    () => {
      expect(summary.maxWinHits / MATH_RUNS).toBeLessThan(0.0005);
    },
    MATH_TIMEOUT
  );
});
