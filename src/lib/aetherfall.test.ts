import { beforeAll, describe, expect, it } from "vitest";
import {
  AETHERFALL_CONFIG,
  getAetherfallTheoreticalRtp,
  resolveAetherfallRound,
  simulateAetherfall,
  type AetherfallLead
} from "./aetherfall";

const LEADS: AetherfallLead[] = ["vanguard", "spellblade", "shadow"];
const MATH_RUNS = 250_000;
const MATH_TIMEOUT = 60_000;

describe("Aetherfall engine", () => {
  it("resolves deterministic rounds from a seed and lead", () => {
    for (const lead of LEADS) {
      const first = resolveAetherfallRound({ seed: "same-seed", stake: 1, lead });
      const second = resolveAetherfallRound({ seed: "same-seed", stake: 1, lead });
      expect(first).toEqual(second);
    }
  });

  it("keeps every volatility profile at exactly 95% theoretical RTP", () => {
    for (const lead of LEADS) {
      const rtp = getAetherfallTheoreticalRtp(lead);
      expect(rtp).toBe(AETHERFALL_CONFIG.targetRtp);
      expect(rtp).toBeGreaterThanOrEqual(0.94);
      expect(rtp).toBeLessThanOrEqual(0.96);
    }
  });

  it("scales payouts linearly with stake", () => {
    for (const lead of LEADS) {
      const one = resolveAetherfallRound({ seed: `stake-${lead}`, stake: 1, lead });
      const two = resolveAetherfallRound({ seed: `stake-${lead}`, stake: 2, lead });
      expect(two.payoutMultiplier).toBe(one.payoutMultiplier);
      expect(two.cappedWin).toBeCloseTo(one.cappedWin * 2, 4);
    }
  });

  it("never exceeds the 1000x cap", () => {
    for (let index = 0; index < 10_000; index += 1) {
      const round = resolveAetherfallRound({ seed: `cap-${index}`, stake: 5, lead: "shadow" });
      expect(round.cappedWin).toBeLessThanOrEqual(AETHERFALL_CONFIG.maxWin * 5);
    }
  });
});

describe("Aetherfall math", () => {
  const summaries = new Map<AetherfallLead, ReturnType<typeof simulateAetherfall>>();

  beforeAll(() => {
    for (const lead of LEADS) summaries.set(lead, simulateAetherfall(MATH_RUNS, lead));
  }, MATH_TIMEOUT);

  it(
    "keeps deterministic 250k-round samples inside 94-96% RTP",
    () => {
      for (const lead of LEADS) {
        const summary = summaries.get(lead)!;
        expect(summary.rtp).toBeGreaterThanOrEqual(0.94);
        expect(summary.rtp).toBeLessThanOrEqual(0.96);
        expect(summary.theoreticalRtp).toBe(0.95);
      }
    },
    MATH_TIMEOUT
  );

  it("makes the three leads meaningfully different volatility profiles", () => {
    const vanguard = summaries.get("vanguard")!;
    const spellblade = summaries.get("spellblade")!;
    const shadow = summaries.get("shadow")!;

    expect(vanguard.hitRate).toBeGreaterThan(spellblade.hitRate);
    expect(spellblade.hitRate).toBeGreaterThan(shadow.hitRate);
    expect(vanguard.hitRate).toBeGreaterThan(0.9);
    expect(shadow.hitRate).toBeLessThan(0.45);
  });
});
