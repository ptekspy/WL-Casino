import { readFile, writeFile } from "node:fs/promises";

const path = "src/lib/wildwood.ts";
let source = await readFile(path, "utf8");
source = source.replace(/baseScalar: [0-9.]+,/, "baseScalar: 0.8311,");
source = source.replace(/bonusScalar: [0-9.]+,/, "bonusScalar: 0.2145,");
await writeFile(path, source);
console.log("Applied smoke-seed payout retune.");
