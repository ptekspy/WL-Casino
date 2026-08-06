import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { WILDWOOD_CONFIG, simulateWildwood } from "../src/lib/wildwood";
import { DRAGONFORGE_CONFIG, simulateDragonforge } from "../src/lib/dragonforge";

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 1) {
  const current = process.argv[index];
  if (!current.startsWith("--")) continue;
  const next = process.argv[index + 1];
  if (next === undefined || next.startsWith("--")) {
    args.set(current.slice(2), "true");
  } else {
    args.set(current.slice(2), next);
    index += 1;
  }
}

const game = args.get("game") === "dragonforge" ? "dragonforge" : "wildwood";

if (args.get("tune") === "true") {
  if (game === "dragonforge") tuneDragonforge(Number(args.get("tuneRuns") ?? 120_000));
  else tuneWildwood(Number(args.get("tuneRuns") ?? 120_000));
} else if (game === "dragonforge") {
  reportDragonforge(Number(args.get("runs") ?? 1000), args.get("out"));
} else {
  reportWildwood(Number(args.get("runs") ?? 1000), args.get("out"));
}

/**
 * Resolves `baseScalar` and `bonusScalar` so total RTP lands on
 * `WILDWOOD_CONFIG.targetRtp`, holding the base/bonus split at `bonusShare`.
 *
 * Payout is linear in each scalar *before* the max-win cap, so scaling by the
 * observed ratio converges in a few passes. The cap makes it slightly
 * sublinear at the top end, which is why this iterates rather than solving once.
 *
 * Re-run after changing any weight or symbol value, then paste the resolved
 * scalars back into WILDWOOD_CONFIG.
 */
function tuneWildwood(tuneRuns: number) {
  const target = WILDWOOD_CONFIG.targetRtp;
  const bonusShare = 0.39;
  const baseTarget = target * (1 - bonusShare);
  const bonusTarget = target * bonusShare;

  console.log(
    `Tuning Wildwood against ${tuneRuns.toLocaleString()} rounds — target RTP ${(target * 100).toFixed(1)}% ` +
      `(base ${(baseTarget * 100).toFixed(1)}% / bonus ${(bonusTarget * 100).toFixed(1)}%)\n`
  );

  for (let iteration = 1; iteration <= 8; iteration += 1) {
    const summary = simulateWildwood(tuneRuns, `tune${iteration}`);

    console.log(
      `  pass ${iteration}: baseScalar=${WILDWOOD_CONFIG.baseScalar.toFixed(5)} bonusScalar=${WILDWOOD_CONFIG.bonusScalar.toFixed(5)}` +
        ` -> rtp=${(summary.rtp * 100).toFixed(2)}% (base ${(summary.baseRtp * 100).toFixed(2)}% / bonus ${(summary.bonusRtp * 100).toFixed(2)}%)`
    );

    if (Math.abs(summary.rtp - target) < 0.003) {
      console.log(`\nConverged. Paste into WILDWOOD_CONFIG:\n  baseScalar: ${WILDWOOD_CONFIG.baseScalar.toFixed(5)},\n  bonusScalar: ${WILDWOOD_CONFIG.bonusScalar.toFixed(5)},`);
      return;
    }

    if (summary.baseRtp > 0) WILDWOOD_CONFIG.baseScalar *= baseTarget / summary.baseRtp;
    if (summary.bonusRtp > 0) WILDWOOD_CONFIG.bonusScalar *= bonusTarget / summary.bonusRtp;
  }

  console.log(`\nStopped after 8 passes. Current:\n  baseScalar: ${WILDWOOD_CONFIG.baseScalar.toFixed(5)},\n  bonusScalar: ${WILDWOOD_CONFIG.bonusScalar.toFixed(5)},`);
}

/**
 * Same convergence approach as tuneWildwood, aimed at DRAGONFORGE_CONFIG's
 * baseScalar/delveScalar. The Hoard triggers far less often than Wildwood's
 * bonus (well under 1% of rounds) and pays out through a compounding
 * multiplier rather than a fixed breath count, so bonusRtp is much noisier
 * sample-to-sample — a full jump to the "correct" ratio each pass overshoots
 * and oscillates. Damping the delveScalar step trades convergence speed for
 * stability; baseScalar (driven by the low-variance base game) doesn't need it.
 */
function tuneDragonforge(tuneRuns: number) {
  const target = DRAGONFORGE_CONFIG.targetRtp;
  const bonusShare = 0.39;
  const baseTarget = target * (1 - bonusShare);
  const bonusTarget = target * bonusShare;
  const delveDamping = 0.35;
  const passes = 16;

  console.log(
    `Tuning Dragonforge against ${tuneRuns.toLocaleString()} rounds — target RTP ${(target * 100).toFixed(1)}% ` +
      `(base ${(baseTarget * 100).toFixed(1)}% / bonus ${(bonusTarget * 100).toFixed(1)}%)\n`
  );

  for (let iteration = 1; iteration <= passes; iteration += 1) {
    const summary = simulateDragonforge(tuneRuns, `tune${iteration}`);

    console.log(
      `  pass ${iteration}: baseScalar=${DRAGONFORGE_CONFIG.baseScalar.toFixed(5)} delveScalar=${DRAGONFORGE_CONFIG.delveScalar.toFixed(5)}` +
        ` -> rtp=${(summary.rtp * 100).toFixed(2)}% (base ${(summary.baseRtp * 100).toFixed(2)}% / bonus ${(summary.bonusRtp * 100).toFixed(2)}%,` +
        ` bonus rate ${(summary.bonusRate * 100).toFixed(3)}%, dragon wake rate ${(summary.dragonWakeRate * 100).toFixed(1)}%)`
    );

    if (Math.abs(summary.rtp - target) < 0.004) {
      console.log(
        `\nConverged. Paste into DRAGONFORGE_CONFIG:\n  baseScalar: ${DRAGONFORGE_CONFIG.baseScalar.toFixed(5)},\n  delveScalar: ${DRAGONFORGE_CONFIG.delveScalar.toFixed(5)},`
      );
      return;
    }

    if (summary.baseRtp > 0) DRAGONFORGE_CONFIG.baseScalar *= baseTarget / summary.baseRtp;
    if (summary.bonusRtp > 0) {
      const rawRatio = bonusTarget / summary.bonusRtp;
      DRAGONFORGE_CONFIG.delveScalar *= 1 + delveDamping * (rawRatio - 1);
    }
  }

  console.log(
    `\nStopped after ${passes} passes. Current:\n  baseScalar: ${DRAGONFORGE_CONFIG.baseScalar.toFixed(5)},\n  delveScalar: ${DRAGONFORGE_CONFIG.delveScalar.toFixed(5)},`
  );
}

function reportWildwood(sampleSize: number, outPath: string | undefined) {
  const summary = simulateWildwood(sampleSize);
  const markdown = `# Wildwood Simulation Report

Target RTP ${(WILDWOOD_CONFIG.targetRtp * 100).toFixed(1)}% ±${(WILDWOOD_CONFIG.rtpTolerance * 100).toFixed(1)}pp.

| Metric | Value |
|---|---:|
| Runs | ${summary.runs.toLocaleString()} |
| RTP | ${(summary.rtp * 100).toFixed(3)}% |
| — base game | ${(summary.baseRtp * 100).toFixed(3)}% |
| — bonus | ${(summary.bonusRtp * 100).toFixed(3)}% |
| Uncapped RTP | ${(summary.uncappedRtp * 100).toFixed(3)}% |
| House edge | ${(summary.houseEdge * 100).toFixed(3)}% |
| Hit rate | ${(summary.hitRate * 100).toFixed(3)}% |
| Profit win rate | ${(summary.profitWinRate * 100).toFixed(3)}% |
| Dead-board rate | ${(summary.deadBoardRate * 100).toFixed(3)}% |
| Bonus rate | ${(summary.bonusRate * 100).toFixed(3)}%${summary.bonusRate > 0 ? ` (1 in ${Math.round(1 / summary.bonusRate).toLocaleString()})` : ""} |
| Near-miss rate | ${(summary.nearMissRate * 100).toFixed(3)}% |
| Average cascades | ${summary.averageCascades.toFixed(3)} |
| Median win | ${summary.medianWin.toFixed(2)}x |
| p95 win | ${summary.p95Win.toFixed(2)}x |
| p99 win | ${summary.p99Win.toFixed(2)}x |
| Max-win cap hits | ${summary.maxWinHits.toLocaleString()} |
| Highest uncapped win | ${summary.highestUncappedWin.toFixed(3)}x |
| RTP removed by cap | ${(summary.capRtpRemoved * 100).toFixed(3)}% |

> Prototype simulation only. This is not a certified gambling math sheet.
`;

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, markdown);
    console.log(`Wrote ${outPath}`);
  } else {
    console.log(markdown);
  }
}

function reportDragonforge(sampleSize: number, outPath: string | undefined) {
  const summary = simulateDragonforge(sampleSize);
  const markdown = `# Dragonforge Simulation Report

Target RTP ${(DRAGONFORGE_CONFIG.targetRtp * 100).toFixed(1)}% ±${(DRAGONFORGE_CONFIG.rtpTolerance * 100).toFixed(1)}pp.

| Metric | Value |
|---|---:|
| Runs | ${summary.runs.toLocaleString()} |
| RTP | ${(summary.rtp * 100).toFixed(3)}% |
| — base game | ${(summary.baseRtp * 100).toFixed(3)}% |
| — Hoard bonus | ${(summary.bonusRtp * 100).toFixed(3)}% |
| Uncapped RTP | ${(summary.uncappedRtp * 100).toFixed(3)}% |
| House edge | ${(summary.houseEdge * 100).toFixed(3)}% |
| Hit rate | ${(summary.hitRate * 100).toFixed(3)}% |
| Profit win rate | ${(summary.profitWinRate * 100).toFixed(3)}% |
| Dead-board rate | ${(summary.deadBoardRate * 100).toFixed(3)}% |
| Hoard trigger rate | ${(summary.bonusRate * 100).toFixed(3)}%${summary.bonusRate > 0 ? ` (1 in ${Math.round(1 / summary.bonusRate).toLocaleString()})` : ""} |
| Dragon wake rate (of Hoards) | ${(summary.dragonWakeRate * 100).toFixed(3)}% |
| Average delves per Hoard | ${summary.averageDelves.toFixed(3)} |
| Near-miss rate | ${(summary.nearMissRate * 100).toFixed(3)}% |
| Average cascades | ${summary.averageCascades.toFixed(3)} |
| Median win | ${summary.medianWin.toFixed(2)}x |
| p95 win | ${summary.p95Win.toFixed(2)}x |
| p99 win | ${summary.p99Win.toFixed(2)}x |
| Max-win cap hits | ${summary.maxWinHits.toLocaleString()} |
| Highest uncapped win | ${summary.highestUncappedWin.toFixed(3)}x |
| RTP removed by cap | ${(summary.capRtpRemoved * 100).toFixed(3)}% |

> Prototype simulation only. This is not a certified gambling math sheet.
`;

  if (outPath) {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, markdown);
    console.log(`Wrote ${outPath}`);
  } else {
    console.log(markdown);
  }
}
