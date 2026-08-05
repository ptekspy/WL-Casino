import { beforeAll, describe, expect, it } from "vitest";
import { WILDWOOD_CONFIG, applyChanges, isAllowedStake, resolveWildwoodRound, simulateWildwood } from "./wildwood";

/**
 * Sample size for the math guards. `simulateWildwood` is deterministic for a
 * given seed prefix, so these assertions never flake — but they are still a
 * sample, and the bonus is heavy-tailed (hits 1 in ~125 and can pay 1000x). At
 * 200k rounds the batch-to-batch spread of total RTP is about ±1.4pp, which is
 * why the total-RTP band below is wider than `rtpTolerance`.
 *
 * The authoritative figure comes from the tuner: over 3.2M rounds the engine
 * returns 95.19% (95% CI 94.50–95.88%), split 58.2% base / 37.3% bonus.
 * Re-run `pnpm sim:tune` after touching any weight or symbol value.
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

  it("only accepts configured stakes", () => {
    for (const stake of WILDWOOD_CONFIG.allowedStakes) expect(isAllowedStake(stake)).toBe(true);
    for (const stake of [0, -1, 0.3, 10, 1e12, Number.NaN, Number.POSITIVE_INFINITY, "1", null, undefined]) {
      expect(isAllowedStake(stake)).toBe(false);
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
    // Worst observed over 200k rounds is 21 KB, for a 34-step bonus. The same
    // round would be ~85 KB if each step still carried a full 36-cell clone.
    expect(largest).toBeLessThan(32_000);
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
