import { createRng, xmur3, type Rng } from "./engine/rng";
import { percentile, roundMoney, roundRatio } from "./engine/money";

export type AetherfallLead = "vanguard" | "spellblade" | "shadow";
export type AetherfallEncounterRank = "normal" | "elite" | "boss";
export type AetherfallResolution = "victory" | "retreat" | "partyWipe";

export type AetherfallCombatStep = {
  turn: number;
  actor: string;
  action: string;
  message: string;
  damage: number;
  partyHp: number;
  enemyHp: number;
  limitMeter: number;
  critical?: boolean;
};

export type AetherfallRoundResult = {
  roundId: string;
  seed: string;
  stake: number;
  lead: AetherfallLead;
  encounter: {
    name: string;
    rank: AetherfallEncounterRank;
    maxHp: number;
  };
  resolution: AetherfallResolution;
  payoutMultiplier: number;
  uncappedWin: number;
  cappedWin: number;
  capApplied: boolean;
  steps: AetherfallCombatStep[];
};

export type AetherfallSimulationSummary = {
  runs: number;
  lead: AetherfallLead;
  rtp: number;
  theoreticalRtp: number;
  houseEdge: number;
  hitRate: number;
  profitWinRate: number;
  medianWin: number;
  p95Win: number;
  p99Win: number;
  maxWinHits: number;
};

type PayoutOutcome = {
  weight: number;
  multiplier: number;
};

export const AETHERFALL_CONFIG = {
  targetRtp: 0.95,
  rtpTolerance: 0.01,
  maxWin: 1000,
  allowedStakes: [0.2, 0.5, 1, 2, 5] as const,
  defaultLead: "spellblade" as AetherfallLead,
  payoutWeightTotal: 1_000_000
};

/**
 * All three leads return exactly 95% in the long run. The only thing the
 * selection changes is volatility: Vanguard pays often and small, Spellblade
 * is balanced, Shadow misses far more often but carries the fatter tail.
 *
 * Weight total is one million for every profile so the theoretical RTP is
 * auditable without simulation: sum(weight * multiplier) / 1_000_000.
 */
const PAYTABLES: Record<AetherfallLead, readonly PayoutOutcome[]> = {
  vanguard: [
    { multiplier: 0, weight: 44_000 },
    { multiplier: 0.25, weight: 100_000 },
    { multiplier: 0.5, weight: 100_000 },
    { multiplier: 0.75, weight: 100_000 },
    { multiplier: 1, weight: 456_000 },
    { multiplier: 1.25, weight: 100_000 },
    { multiplier: 1.5, weight: 50_000 },
    { multiplier: 2, weight: 30_000 },
    { multiplier: 3, weight: 15_000 },
    { multiplier: 5, weight: 4_000 },
    { multiplier: 10, weight: 800 },
    { multiplier: 50, weight: 180 },
    { multiplier: 100, weight: 20 }
  ],
  spellblade: [
    { multiplier: 0, weight: 225_289 },
    { multiplier: 0.25, weight: 150_000 },
    { multiplier: 0.5, weight: 120_000 },
    { multiplier: 1, weight: 406_500 },
    { multiplier: 2, weight: 60_000 },
    { multiplier: 5, weight: 25_000 },
    { multiplier: 10, weight: 10_000 },
    { multiplier: 25, weight: 3_000 },
    { multiplier: 100, weight: 200 },
    { multiplier: 500, weight: 10 },
    { multiplier: 1000, weight: 1 }
  ],
  shadow: [
    { multiplier: 0, weight: 616_978 },
    { multiplier: 0.25, weight: 40_000 },
    { multiplier: 0.5, weight: 30_000 },
    { multiplier: 1, weight: 243_000 },
    { multiplier: 2, weight: 25_000 },
    { multiplier: 5, weight: 20_000 },
    { multiplier: 10, weight: 12_000 },
    { multiplier: 25, weight: 12_000 },
    { multiplier: 100, weight: 1_000 },
    { multiplier: 500, weight: 20 },
    { multiplier: 1000, weight: 2 }
  ]
};

const PARTY = ["Vanguard", "Spellblade", "Ranger", "White Sage"] as const;

const ACTIONS: Record<(typeof PARTY)[number], readonly string[]> = {
  Vanguard: ["Astral Cleave", "Shield Break", "Meteor Guard"],
  Spellblade: ["Aetherflare", "Arc Blade", "Crystal Burst"],
  Ranger: ["Twin Shot", "Moonpiercer", "Storm Volley"],
  "White Sage": ["Radiant Ward", "Starfall", "Lumen Spear"]
};

const ENCOUNTERS: Record<AetherfallEncounterRank, readonly string[]> = {
  normal: ["Gloomfang", "Crystal Warden", "Ash Drake"],
  elite: ["Void Chimera", "Iron Seraph", "Storm Behemoth"],
  boss: ["The Fallen Astral", "Leviathan of Glass", "Crownwyrm"]
};

export function isAetherfallLead(value: unknown): value is AetherfallLead {
  return value === "vanguard" || value === "spellblade" || value === "shadow";
}

export function getAetherfallTheoreticalRtp(lead: AetherfallLead): number {
  const table = PAYTABLES[lead];
  const totalWeight = table.reduce((total, outcome) => total + outcome.weight, 0);
  const expectedMultiplier = table.reduce((total, outcome) => total + outcome.weight * outcome.multiplier, 0) / totalWeight;
  return roundRatio(expectedMultiplier);
}

export function resolveAetherfallRound(input: {
  seed: string;
  stake?: number;
  lead?: AetherfallLead;
}): AetherfallRoundResult {
  const stake = input.stake ?? 1;
  const lead = input.lead ?? AETHERFALL_CONFIG.defaultLead;
  const rng = createRng(input.seed);

  // Resolve money first. Everything after this point is presentation-only RNG
  // so animation, enemy choice and damage numbers can never alter the payout.
  const payoutOutcome = rng.pickWeighted(PAYTABLES[lead]);
  const payoutMultiplier = payoutOutcome.multiplier;
  const encounterRank = rankForMultiplier(payoutMultiplier);
  const encounter = createEncounter(encounterRank, rng);
  const resolution = resolutionForMultiplier(payoutMultiplier);
  const steps = buildCombatReplay({ rng, lead, encounter, payoutMultiplier, resolution });

  const uncappedWin = roundMoney(payoutMultiplier * stake);
  const cappedWin = roundMoney(Math.min(uncappedWin, AETHERFALL_CONFIG.maxWin * stake));

  return {
    roundId: `af_${xmur3(input.seed)().toString(36)}`,
    seed: input.seed,
    stake,
    lead,
    encounter,
    resolution,
    payoutMultiplier,
    uncappedWin,
    cappedWin,
    capApplied: uncappedWin > cappedWin,
    steps
  };
}

export function simulateAetherfall(
  runs: number,
  lead: AetherfallLead = AETHERFALL_CONFIG.defaultLead,
  seedPrefix = "rtp"
): AetherfallSimulationSummary {
  const safeRuns = Math.max(1, Math.floor(runs));
  const wins = new Float64Array(safeRuns);
  let totalWin = 0;
  let hitCount = 0;
  let profitWinCount = 0;
  let maxWinHits = 0;

  for (let index = 0; index < safeRuns; index += 1) {
    const rng = createRng(`${seedPrefix}-${lead}-${index}`);
    const multiplier = rng.pickWeighted(PAYTABLES[lead]).multiplier;
    wins[index] = multiplier;
    totalWin += multiplier;
    if (multiplier > 0) hitCount += 1;
    if (multiplier > 1) profitWinCount += 1;
    if (multiplier >= AETHERFALL_CONFIG.maxWin) maxWinHits += 1;
  }

  wins.sort();
  const rtp = totalWin / safeRuns;

  return {
    runs: safeRuns,
    lead,
    rtp: roundRatio(rtp),
    theoreticalRtp: getAetherfallTheoreticalRtp(lead),
    houseEdge: roundRatio(1 - rtp),
    hitRate: roundRatio(hitCount / safeRuns),
    profitWinRate: roundRatio(profitWinCount / safeRuns),
    medianWin: percentile(wins, 0.5),
    p95Win: percentile(wins, 0.95),
    p99Win: percentile(wins, 0.99),
    maxWinHits
  };
}

function rankForMultiplier(multiplier: number): AetherfallEncounterRank {
  if (multiplier >= 25) return "boss";
  if (multiplier >= 5) return "elite";
  return "normal";
}

function resolutionForMultiplier(multiplier: number): AetherfallResolution {
  if (multiplier === 0) return "partyWipe";
  if (multiplier < 1) return "retreat";
  return "victory";
}

function createEncounter(rank: AetherfallEncounterRank, rng: Rng) {
  const names = ENCOUNTERS[rank];
  const name = names[rng.int(0, names.length - 1)];
  const maxHp = rank === "boss" ? 24_000 : rank === "elite" ? 11_000 : 5_500;
  return { name, rank, maxHp };
}

function buildCombatReplay(input: {
  rng: Rng;
  lead: AetherfallLead;
  encounter: { name: string; rank: AetherfallEncounterRank; maxHp: number };
  payoutMultiplier: number;
  resolution: AetherfallResolution;
}): AetherfallCombatStep[] {
  const turns = input.encounter.rank === "boss" ? 7 : input.encounter.rank === "elite" ? 6 : 5;
  let partyHp = 100;
  let enemyHp = input.encounter.maxHp;
  let limitMeter = 0;
  const steps: AetherfallCombatStep[] = [];

  for (let turn = 1; turn <= turns; turn += 1) {
    const isFinal = turn === turns;
    const partyActs = input.resolution !== "partyWipe" || !isFinal;

    if (partyActs) {
      const actor = actorForTurn(turn, input.lead);
      const action = pick(ACTIONS[actor], input.rng);
      const critical = input.rng.chance(input.payoutMultiplier >= 5 ? 0.32 : 0.12);
      const remainingTurns = turns - turn + 1;
      const targetDamage = isFinal && input.resolution === "victory" ? enemyHp : Math.floor(enemyHp / Math.max(2, remainingTurns + 1));
      const variance = input.rng.int(78, 122) / 100;
      const damage = Math.max(1, Math.min(enemyHp, Math.floor(targetDamage * variance * (critical ? 1.6 : 1))));
      enemyHp = input.resolution === "victory" && isFinal ? 0 : Math.max(1, enemyHp - damage);
      limitMeter = Math.min(100, limitMeter + input.rng.int(12, 24) + (critical ? 8 : 0));

      steps.push({
        turn,
        actor,
        action: isFinal && input.payoutMultiplier >= 5 ? finisherForLead(input.lead) : action,
        message: isFinal ? closingMessage(input.resolution, input.payoutMultiplier) : `${actor} uses ${action}.`,
        damage: isFinal && input.resolution === "victory" ? Math.max(damage, 1) : damage,
        partyHp,
        enemyHp,
        limitMeter: isFinal && input.payoutMultiplier >= 5 ? 100 : limitMeter,
        critical: critical || (isFinal && input.payoutMultiplier >= 10)
      });
    } else {
      const damageToParty = input.rng.int(35, 55);
      partyHp = Math.max(0, partyHp - damageToParty);
      steps.push({
        turn,
        actor: input.encounter.name,
        action: "Astral Ruin",
        message: `${input.encounter.name} breaks the party. The expedition is lost.`,
        damage: 0,
        partyHp: 0,
        enemyHp,
        limitMeter
      });
    }

    if (!isFinal && input.rng.chance(0.55)) {
      partyHp = Math.max(input.resolution === "partyWipe" ? 15 : 30, partyHp - input.rng.int(5, 16));
    }
  }

  if (input.resolution === "retreat") {
    const last = steps[steps.length - 1];
    last.enemyHp = Math.max(1, last.enemyHp);
    last.message = `The party retreats with ${input.payoutMultiplier.toFixed(2)}x of the stake secured.`;
  }

  return steps;
}

function actorForTurn(turn: number, lead: AetherfallLead): (typeof PARTY)[number] {
  if (turn === 1) {
    if (lead === "vanguard") return "Vanguard";
    if (lead === "shadow") return "Ranger";
    return "Spellblade";
  }
  return PARTY[(turn - 1) % PARTY.length];
}

function finisherForLead(lead: AetherfallLead): string {
  if (lead === "vanguard") return "Aegis Limit: Worldbreaker";
  if (lead === "shadow") return "Shadow Limit: Eclipse Barrage";
  return "Spellblade Limit: Aether Nova";
}

function closingMessage(resolution: AetherfallResolution, multiplier: number): string {
  if (resolution === "partyWipe") return "The expedition collapses. No treasure survives the battle.";
  if (resolution === "retreat") return `The party escapes with ${multiplier.toFixed(2)}x salvage.`;
  if (multiplier >= 1000) return "Mythic victory. The Astral Vault opens for the 1000x maximum win.";
  if (multiplier >= 25) return `Boss defeated. The vault releases ${multiplier.toFixed(2)}x.`;
  return `Victory. The party secures ${multiplier.toFixed(2)}x.`;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[rng.int(0, items.length - 1)];
}
