import { describe, expect, it } from "vitest";
import { WILDWOOD_CONFIG, resolveWildwoodRound, simulateWildwood } from "./wildwood";

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

  it("tracks uncapped win while enforcing the 1000x cap", () => {
    for (let index = 0; index < 200; index += 1) {
      const round = resolveWildwoodRound({ seed: `cap-${index}`, stake: 2 });
      expect(round.cappedWin).toBeLessThanOrEqual(WILDWOOD_CONFIG.maxWin * 2);
      expect(round.uncappedWin).toBeGreaterThanOrEqual(round.cappedWin);
    }
  });

  it("runs a simulation summary", () => {
    const summary = simulateWildwood(100);
    expect(summary.runs).toBe(100);
    expect(summary.rtp).toBeGreaterThanOrEqual(0);
  });
});
