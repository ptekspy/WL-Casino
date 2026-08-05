import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const runs = Number(process.env.EXPERIMENT_RUNS ?? 1_000_000);
const sourcePath = "src/lib/wildwood.ts";
const original = readFileSync(sourcePath, "utf8");
const reportsDir = "reports/cascade-value-experiment";
mkdirSync(reportsDir, { recursive: true });

const variants = [
  {
    slug: "baseline",
    label: "Current curve",
    description: "Existing 1x, 1.3x, 1.7x, 2.2x, 3x, 4x cascade multipliers"
  },
  {
    slug: "replace-linear-25",
    label: "Linear +25%",
    description: "Replace current curve with 1x, 1.25x, 1.5x, 1.75x, 2x, 2.25x",
    curve: [1, 1.25, 1.5, 1.75, 2, 2.25]
  },
  {
    slug: "replace-linear-50",
    label: "Linear +50%",
    description: "Replace current curve with 1x, 1.5x, 2x, 2.5x, 3x, 3.5x",
    curve: [1, 1.5, 2, 2.5, 3, 3.5]
  },
  {
    slug: "stack-linear-10",
    label: "Current + extra 10%",
    description: "Keep current curve and multiply collectable values by 1 + 10% per completed cascade",
    growth: 0.1
  },
  {
    slug: "stack-linear-25",
    label: "Current + extra 25%",
    description: "Keep current curve and multiply collectable values by 1 + 25% per completed cascade",
    growth: 0.25
  }
];

const curvePattern = /cascadeMultipliers: \[[^\]]+\] as const,/;
const collectionLine = "const collection = resolveCollection(board, cascadeMultiplier * WILDWOOD_CONFIG.baseScalar);";

function applyVariant(variant) {
  let source = original;
  if (variant.curve) {
    source = source.replace(curvePattern, `cascadeMultipliers: [${variant.curve.join(", ")}] as const,`);
  }
  if (variant.growth) {
    const replacement = `const collectableValueGrowth = 1 + (cascade - 1) * ${variant.growth};\n    const collection = resolveCollection(board, cascadeMultiplier * collectableValueGrowth * WILDWOOD_CONFIG.baseScalar);`;
    if (!source.includes(collectionLine)) throw new Error("Base collection line not found");
    source = source.replace(collectionLine, replacement);
  }
  writeFileSync(sourcePath, source);
}

function parseReport(markdown) {
  const result = {};
  for (const line of markdown.split("\n")) {
    const match = /^\| ([^|]+) \| ([^|]+) \|$/.exec(line);
    if (match) result[match[1].trim()] = match[2].trim();
  }
  return result;
}

const results = [];
try {
  for (const variant of variants) {
    applyVariant(variant);
    const out = `${reportsDir}/${variant.slug}.md`;
    console.log(`\n=== ${variant.label}: ${runs.toLocaleString()} rounds ===`);
    execFileSync("pnpm", ["sim", "--", "--runs", String(runs), "--out", out], { stdio: "inherit" });
    results.push({ ...variant, metrics: parseReport(readFileSync(out, "utf8")) });
  }
} finally {
  writeFileSync(sourcePath, original);
}

const metric = (result, name) => result.metrics[name] ?? "n/a";
const summary = `# Wildwood Cascade Value Growth Experiment

Each variant used the same deterministic seed series over **${runs.toLocaleString()} rounds**. Production source and payout scalars were held constant; only the base-game cascade value rule changed. Bonus-breath math was unchanged.

| Variant | RTP | Base RTP | Bonus RTP | Hit rate | Profit win | Avg cascades | p95 | p99 | Cap hits | Cap RTP removed |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
${results.map((r) => `| ${r.label} | ${metric(r, "RTP")} | ${metric(r, "— base game")} | ${metric(r, "— bonus")} | ${metric(r, "Hit rate")} | ${metric(r, "Profit win rate")} | ${metric(r, "Average cascades")} | ${metric(r, "p95 win")} | ${metric(r, "p99 win")} | ${metric(r, "Max-win cap hits")} | ${metric(r, "RTP removed by cap")} |`).join("\n")}

## Rules tested

${results.map((r) => `- **${r.label}:** ${r.description}`).join("\n")}

## Notes

- The current game already increases payout by cascade using its existing multiplier curve.
- Replacement variants test a clearer linear value-growth rule instead of the current curve.
- Stacked variants test literal collectable-value growth on top of the current cascade multiplier, which is expected to raise RTP unless scalars are retuned.
- This remains prototype simulation, not a certified gambling math sheet.
`;

writeFileSync(`${reportsDir}/summary.md`, summary);
console.log(`\n${summary}`);
