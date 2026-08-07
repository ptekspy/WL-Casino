import { AETHERFALL_CONFIG, getAetherfallTheoreticalRtp, simulateAetherfall, type AetherfallLead } from "../src/lib/aetherfall";

const runsArg = process.argv.find((value) => value.startsWith("--runs="));
const runs = Math.max(1, Math.floor(Number(runsArg?.split("=")[1] ?? 1_000_000)));
const leads: AetherfallLead[] = ["vanguard", "spellblade", "shadow"];

console.log(`# Aetherfall RTP simulation\n`);
console.log(`Target: ${(AETHERFALL_CONFIG.targetRtp * 100).toFixed(2)}% RTP / ${((1 - AETHERFALL_CONFIG.targetRtp) * 100).toFixed(2)}% house edge`);
console.log(`Runs per lead: ${runs.toLocaleString()}\n`);
console.log("| Lead | Theoretical RTP | Simulated RTP | House edge | Hit rate | Profit win rate | Max wins |");
console.log("|---|---:|---:|---:|---:|---:|---:|");

for (const lead of leads) {
  const summary = simulateAetherfall(runs, lead);
  console.log(
    `| ${lead} | ${(getAetherfallTheoreticalRtp(lead) * 100).toFixed(3)}% | ${(summary.rtp * 100).toFixed(3)}% | ${(summary.houseEdge * 100).toFixed(3)}% | ${(summary.hitRate * 100).toFixed(3)}% | ${(summary.profitWinRate * 100).toFixed(3)}% | ${summary.maxWinHits.toLocaleString()} |`
  );
}

console.log("\n> Prototype simulation only. This is not a certified gambling math sheet.");
