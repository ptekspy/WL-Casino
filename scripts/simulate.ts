import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { simulateWildwood } from "../src/lib/wildwood";

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 1) {
  const current = process.argv[index];
  if (!current.startsWith("--")) continue;
  args.set(current.slice(2), process.argv[index + 1] ?? "true");
  index += 1;
}

const runs = Number(args.get("runs") ?? 1000);
const out = args.get("out");
const summary = simulateWildwood(runs);
const markdown = `# Wildwood Simulation Report

| Metric | Value |
|---|---:|
| Runs | ${summary.runs.toLocaleString()} |
| RTP | ${(summary.rtp * 100).toFixed(3)}% |
| Uncapped RTP | ${(summary.uncappedRtp * 100).toFixed(3)}% |
| House edge | ${(summary.houseEdge * 100).toFixed(3)}% |
| Hit rate | ${(summary.hitRate * 100).toFixed(3)}% |
| Profit win rate | ${(summary.profitWinRate * 100).toFixed(3)}% |
| Dead-board rate | ${(summary.deadBoardRate * 100).toFixed(3)}% |
| Bonus rate | ${(summary.bonusRate * 100).toFixed(3)}% |
| Near-miss rate | ${(summary.nearMissRate * 100).toFixed(3)}% |
| Average cascades | ${summary.averageCascades.toFixed(3)} |
| Max-win cap hits | ${summary.maxWinHits.toLocaleString()} |
| Highest uncapped win | ${summary.highestUncappedWin.toFixed(3)}x |
| RTP removed by cap | ${(summary.capRtpRemoved * 100).toFixed(3)}% |

> Prototype simulation only. This is not a certified gambling math sheet.
`;

if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, markdown);
  console.log(`Wrote ${out}`);
} else {
  console.log(markdown);
}
