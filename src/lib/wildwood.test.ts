import { beforeAll, describe, expect, it } from "vitest";
import type { BoardCell, SymbolType } from "./wildwood";
import { WILDWOOD_CONFIG, applyChanges, formatCollectableValueLabel, getCascadeValueMultiplier, getScaledCollectableValue, isAllowedStake, resolveCollection, resolveWildwoodRound, simulateWildwood } from "./wildwood";

/**
 * Sample size for the math guards. `simulateWildwood` is deterministic for a
 * given seed prefix, so these assertions never flake — but they are still a
 * sample, and the bonus is heavy-tailed (hits 1 in ~125 and can pay 1000x). At
 * 200k rounds the batch-to-batch spread of total RTP is about ±1.4pp, which is
 * why the total-RTP band below is wider than `rtpTolerance`.
 *
 * Persistent Spirit Seeds materially affect both cascade and bonus tails.
 * Re-run `pnpm sim:tune` after changing their lifecycle, any weight, or any
 * symbol value, then validate the resolved scalars over a larger sample.
 */
const MATH_RUNS = 200_000;
const MATH_TIMEOUT = 60_000;

describe("Wildwood engine", () => {
  it("resolves deterministic rounds from a seed", () => {
    const first = resolveWildwoodRound({ seed: "same-seed", stake: 1 });
    const second = resolveWildwoodRound({ seed: "same-seed", stake: 1 });
    expect(first).toEqual(second);
  });

  it("generates a 6x6 board", () => {
    const round = resolveWildwoodRound({ seed: "board-size", stake: 1 });
    expect(round.initialBoard).toHaveLength(WILDWOOD_CONFIG.width * WILDWOOD_CONFIG.height);
  });

  it("derives roundId without consuming the game RNG stream", () => {
    const round = resolveWildwoodRound({ seed: "id-stability", stake: 1 });
    expect(round.roundId).toMatch(/^ww_[0-9a-z]+$/);
    expect(round.roundId).toBe(resolveWildwoodRound({ seed: "id-stability", stake: 1 }).roundId);
  });

  it("gives every produced cell a unique id so React remounts on replacement", () => {
    for (let index = 0; index < 200; index += 1) {
      const round = resolveWildwoodRound({ seed: `ids-${index}`, stake: 1 });
      const ids = round.initialBoard.map((cell) => cell.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("tracks uncapped win while enforcing the 1000x cap", () => {
    for (let index = 0; index < 500; index += 1) {
      const round = resolveWildwoodRound({ seed: `cap-${index}`, stake: 2 });
      expect(round.cappedWin).toBeLessThanOrEqual(WILDWOOD_CONFIG.maxWin * 2);
      expect(round.uncappedWin).toBeGreaterThanOrEqual(round.cappedWin);
    }
  });

  it("increases collectable values by 50% per cascade and formats exact labels", () => {
    expect(WILDWOOD_CONFIG.cascadeMultipliers).toEqual([1, 1.5, 2, 2.5, 3, 3.5]);
    expect(getCascadeValueMultiplier(1)).toBe(1);
    expect(getCascadeValueMultiplier(4)).toBe(2.5);
    expect(getCascadeValueMultiplier(99)).toBe(3.5);
    expect(getScaledCollectableValue("leaf", getCascadeValueMultiplier(2))).toBe(0.0375);
    expect(formatCollectableValueLabel(0.0375)).toBe("0.0375x");
    expect(formatCollectableValueLabel(1.75)).toBe("1.75x");
  });

  it("only accepts configured stakes", () => {
    for (const stake of WILDWOOD_CONFIG.allowedStakes) expect(isAllowedStake(stake)).toBe(true);
    for (const stake of [0, -1, 0.3, 10, 1e12, Number.NaN, Number.POSITIVE_INFINITY, "1", null, undefined]) {
      expect(isAllowedStake(stake)).toBe(false);
    }
  });
});

function buildTestBoard(entries: Array<{ x: number; y: number; symbol: SymbolType }>): BoardCell[] {
  const byCoordinate = new Map(entries.map((entry) => [`${entry.x}:${entry.y}`, entry.symbol]));
  const board: BoardCell[] = [];
  for (let y = 0; y < WILDWOOD_CONFIG.height; y += 1) {
    for (let x = 0; x < WILDWOOD_CONFIG.width; x += 1) {
      const symbol = byCoordinate.get(`${x}:${y}`) ?? "rot";
      board.push({ id: `${x}-${y}-${symbol}`, x, y, symbol, value: WILDWOOD_CONFIG.symbolValues[symbol] });
    }
  }
  return board;
}

describe("collector routes", () => {
  it("lets only one collector claim an overlapping normal symbol, favouring the higher multiplier", () => {
    const board = buildTestBoard([
      { x: 0, y: 0, symbol: "fox" },
      { x: 1, y: 0, symbol: "leaf" },
      { x: 2, y: 0, symbol: "stag" }
    ]);

    const collection = resolveCollection(board);

    // stag (1.5x) outranks fox (1x), so it claims the contested leaf even though fox is first in board order.
    expect(collection.indices).toEqual([1]);
    expect(collection.win).toBeCloseTo(WILDWOOD_CONFIG.symbolValues.leaf * WILDWOOD_CONFIG.collectorMultipliers.stag, 6);
    expect(collection.collectorRoutes).toHaveLength(1);
    expect(collection.collectorRoutes[0].symbol).toBe("stag");
  });

  it("resolves a three-way contest (fox, stag, wisp all reach one leaf) in favour of wisp", () => {
    const board = buildTestBoard([
      { x: 1, y: 1, symbol: "fox" },
      { x: 3, y: 1, symbol: "stag" },
      { x: 1, y: 3, symbol: "wisp" },
      { x: 2, y: 2, symbol: "leaf" }
    ]);

    const collection = resolveCollection(board);

    expect(collection.win).toBeCloseTo(WILDWOOD_CONFIG.symbolValues.leaf * WILDWOOD_CONFIG.collectorMultipliers.wisp, 6);
    expect(collection.collectorRoutes).toHaveLength(1);
    expect(collection.collectorRoutes[0].symbol).toBe("wisp");
  });

  it("keeps a Spirit Seed available to every applicable collector", () => {
    const board = buildTestBoard([
      { x: 0, y: 0, symbol: "owl" },
      { x: 1, y: 0, symbol: "spiritSeed" },
      { x: 2, y: 0, symbol: "wisp" }
    ]);

    const collection = resolveCollection(board);

    expect(collection.indices).toEqual([]);
    expect(collection.spiritSeedsCollected).toBe(1);
    expect(collection.spiritSeedIndices).toEqual([1]);
    expect(board[1].symbol).toBe("spiritSeed");
    // Route order now follows collection priority (wisp 3x before owl 2x), not board order.
    expect(collection.collectorRoutes.map((route) => route.symbol)).toEqual(["wisp", "owl"]);
    expect(collection.win).toBe(
      WILDWOOD_CONFIG.symbolValues.spiritSeed *
        (WILDWOOD_CONFIG.collectorMultipliers.owl + WILDWOOD_CONFIG.collectorMultipliers.wisp)
    );
  });

  it("allows only Spirit Seeds to be claimed by multiple collectors", () => {
    const collectableSymbols: SymbolType[] = ["leaf", "acorn", "mushroom", "bloom", "root", "spiritSeed"];
    const collectorPositions = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 1, y: 2 }
    ];
    const collectorTypes = ["fox", "owl", "stag", "wisp"] as const;

    for (const symbol of collectableSymbols) {
      const applicableCollectors = collectorTypes.filter((collector) =>
        (WILDWOOD_CONFIG.collectorTargets[collector] as readonly SymbolType[]).includes(symbol)
      );
      const board = buildTestBoard([
        { x: 2, y: 2, symbol },
        ...applicableCollectors.map((collector, index) => ({ ...collectorPositions[index], symbol: collector }))
      ]);

      const collection = resolveCollection(board);
      const claimers = collection.collectorRoutes
        .filter((route) => route.moves.some((move) => move.collect && move.x === 2 && move.y === 2))
        .map((route) => route.symbol);

      if (symbol === "spiritSeed") {
        expect(new Set(claimers).size).toBe(applicableCollectors.length);
        expect(collection.indices).not.toContain(2 * WILDWOOD_CONFIG.width + 2);
      } else {
        expect(claimers).toHaveLength(1);
        expect(collection.indices).toContain(2 * WILDWOOD_CONFIG.width + 2);
      }
    }
  });

  it("only routes through the origin, already-cleared cells, or collectable targets", () => {
    const board = buildTestBoard([
      { x: 1, y: 1, symbol: "fox" },
      { x: 2, y: 1, symbol: "leaf" },
      { x: 1, y: 2, symbol: "acorn" },
      { x: 2, y: 2, symbol: "rot" }
    ]);

    const [route] = resolveCollection(board).collectorRoutes;
    expect(route.moves.filter((move) => move.collect)).toHaveLength(2);

    let previous = { x: route.x, y: route.y };
    for (const move of route.moves) {
      expect(Math.max(Math.abs(move.x - previous.x), Math.abs(move.y - previous.y))).toBe(1);
      const symbol = board[move.y * WILDWOOD_CONFIG.width + move.x].symbol;
      if (symbol === "rot") expect(move).not.toHaveProperty("collect");
      previous = move;
    }
  });
});

describe("replay steps", () => {
  it("carries diffs rather than full board clones", () => {
    const round = resolveWildwoodRound({ seed: "diff-shape", stake: 1 });
    for (const step of round.steps) {
      expect(step).not.toHaveProperty("board");
      if (step.changes) expect(step.changes.length).toBeLessThanOrEqual(WILDWOOD_CONFIG.width * WILDWOOD_CONFIG.height);
    }
  });

  it("reconstructs the final board by replaying diffs over the initial board", () => {
    let bonusesCovered = 0;
    for (let index = 0; index < 400; index += 1) {
      const round = resolveWildwoodRound({ seed: `replay-${index}`, stake: 1 });
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

  it("keeps replay payloads small", () => {
    let largest = 0;
    for (let index = 0; index < 20_000; index += 1) {
      largest = Math.max(largest, JSON.stringify(resolveWildwoodRound({ seed: `size-${index}`, stake: 1 })).length);
    }
    // Collector routes add compact movement coordinates to the replay. The
    // worst observed over 200k rounds remains below 34 KB.
    expect(largest).toBeLessThan(40_000);
  });

  it("keeps a dead board close to the wire minimum", () => {
    const dead = resolveWildwoodRound({ seed: "size-1", stake: 1 });
    expect(dead.cascades).toBe(0);
    // ~5 KB, essentially all of it initialBoard + finalBoard. Those two are
    // kept so the response is self-describing; the steps themselves are empty
    // of board data, which is what used to dominate the payload.
    expect(JSON.stringify(dead).length).toBeLessThan(6_000);
    expect(dead.steps.every((step) => !step.changes?.length)).toBe(true);
  });
});

describe("Wildwood math", () => {
  let summary: ReturnType<typeof simulateWildwood>;

  beforeAll(() => {
    summary = simulateWildwood(MATH_RUNS);
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
    "holds the base game near its share of RTP",
    () => {
      // The base game is low-variance, so this is the tight guard — it catches
      // paytable regressions long before the noisy total does.
      expect(summary.baseRtp).toBeGreaterThan(0.55);
      expect(summary.baseRtp).toBeLessThan(0.61);
    },
    MATH_TIMEOUT
  );

  it(
    "keeps the high-volatility shape",
    () => {
      expect(summary.hitRate).toBeGreaterThan(0.22);
      expect(summary.hitRate).toBeLessThan(0.29);
      expect(summary.deadBoardRate).toBeGreaterThan(0.71);
      expect(summary.medianWin).toBe(0);
    },
    MATH_TIMEOUT
  );

  it(
    "triggers the bonus at roughly 1 in 125",
    () => {
      expect(summary.bonusRate).toBeGreaterThan(0.006);
      expect(summary.bonusRate).toBeLessThan(0.011);
    },
    MATH_TIMEOUT
  );

  it(
    "leaves the 1000x cap reachable but rare",
    () => {
      // The previous paytable topped out at 44x, so the cap was unreachable.
      expect(summary.highestUncappedWin).toBeGreaterThan(500);
      expect(summary.maxWinHits / MATH_RUNS).toBeLessThan(0.0001);
    },
    MATH_TIMEOUT
  );
});
