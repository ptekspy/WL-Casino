import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`${label}: source text not found`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`${label}: source text is not unique`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

function patch(path, transform) {
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`${path}: patch made no changes`);
  writeFileSync(path, after);
}

patch("src/lib/wildwood.ts", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    "  /** Applied to cascade N (1-indexed). Rewards chains without inflating the first hit. */\n  cascadeMultipliers: [1, 1.3, 1.7, 2.2, 3, 4] as const,",
    "  /** Collectable value rises by 50% on every successive base-game cascade. */\n  cascadeMultipliers: [1, 1.5, 2, 2.5, 3, 3.5] as const,",
    "cascade curve"
  );

  source = replaceOnce(
    source,
    "};\n\nconst { width, height } = WILDWOOD_CONFIG;",
    `};\n\n/** Returns the authoritative collectable-value multiplier for a base-game cascade. */\nexport function getCascadeValueMultiplier(cascade: number): number {\n  const safeCascade = Number.isFinite(cascade) ? Math.max(1, Math.floor(cascade)) : 1;\n  const index = Math.min(safeCascade, WILDWOOD_CONFIG.cascadeMultipliers.length) - 1;\n  return WILDWOOD_CONFIG.cascadeMultipliers[index];\n}\n\n/** Scales a symbol's displayed collectable value without applying internal RTP scalars. */\nexport function getScaledCollectableValue(symbol: SymbolType, multiplier: number): number {\n  const safeMultiplier = Number.isFinite(multiplier) ? Math.max(0, multiplier) : 1;\n  return Number((WILDWOOD_CONFIG.symbolValues[symbol] * safeMultiplier).toFixed(6));\n}\n\n/** Keeps exact fractional values such as 0.0375x visible instead of rounding to 0.04x. */\nexport function formatCollectableValueLabel(value: number): string {\n  const formatted = value.toFixed(4).replace(/0+$/, \"\").replace(/\\.$/, \"\");\n  return \\`${"${formatted}"}x\\`;\n}\n\nconst { width, height } = WILDWOOD_CONFIG;`,
    "cascade value helpers"
  );

  source = replaceOnce(
    source,
    "    const cascadeMultiplier = WILDWOOD_CONFIG.cascadeMultipliers[Math.min(cascade, WILDWOOD_CONFIG.cascadeMultipliers.length) - 1];",
    "    const cascadeMultiplier = getCascadeValueMultiplier(cascade);",
    "cascade multiplier lookup"
  );
  return source;
});

patch("src/components/wildwood-pixi-board.tsx", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    'import { WILDWOOD_CONFIG, buildFrames } from "@/lib/wildwood";',
    'import { WILDWOOD_CONFIG, buildFrames, formatCollectableValueLabel, getCascadeValueMultiplier, getScaledCollectableValue } from "@/lib/wildwood";',
    "value helper imports"
  );

  source = replaceOnce(
    source,
    "  const cells: CellView[] = [];\n  for (let y = 0; y < ROWS; y += 1) {\n    for (let x = 0; x < COLS; x += 1) {\n      const cell = buildCellView(x, y);\n      boardContainer.addChild(cell.container);\n      cells.push(cell);\n    }\n  }\n\n  // Cinematic center spotlight",
    "  const cells: CellView[] = [];\n  for (let y = 0; y < ROWS; y += 1) {\n    for (let x = 0; x < COLS; x += 1) {\n      const cell = buildCellView(x, y);\n      boardContainer.addChild(cell.container);\n      cells.push(cell);\n    }\n  }\n  let collectableValueMultiplier = 1;\n\n  // Cinematic center spotlight",
    "collectable multiplier state"
  );

  source = replaceOnce(
    source,
    "    const label = isCollector ? `${WILDWOOD_CONFIG.collectorMultipliers[symbol]}x` : `${WILDWOOD_CONFIG.symbolValues[symbol].toFixed(2)}x`;",
    "    const label = isCollector\n      ? `${WILDWOOD_CONFIG.collectorMultipliers[symbol]}x`\n      : formatCollectableValueLabel(getScaledCollectableValue(symbol, collectableValueMultiplier));",
    "dynamic value label"
  );

  source = replaceOnce(
    source,
    "  function drawGlow(cell: CellView) {",
    `  function setCollectableValueMultiplier(multiplier: number) {\n    collectableValueMultiplier = multiplier;\n    for (const cell of cells) {\n      if (!cell.symbol || cell.symbol === \"rot\" || isCollectorSymbol(cell.symbol)) continue;\n      drawValueLabel(cell);\n    }\n  }\n\n  function drawGlow(cell: CellView) {`,
    "value label refresh"
  );

  source = replaceOnce(
    source,
    "    runner.cancelAll();\n    clearFx();",
    "    setCollectableValueMultiplier(1);\n    runner.cancelAll();\n    clearFx();",
    "round value reset"
  );

  source = replaceOnce(
    source,
    "        case \"cascade\":\n          await playRefill(step, myGeneration);",
    "        case \"cascade\":\n          setCollectableValueMultiplier(getCascadeValueMultiplier(cascadeCount + 1));\n          await playRefill(step, myGeneration);",
    "cascade label increase"
  );

  source = replaceOnce(
    source,
    "        case \"bonusTriggered\":\n          wildwoodSound.playBonusTrigger();",
    "        case \"bonusTriggered\":\n          setCollectableValueMultiplier(1);\n          wildwoodSound.playBonusTrigger();",
    "bonus label reset"
  );

  source = replaceOnce(
    source,
    "              multiplier += seedsRewarded;\n              multiplierBadge.set(multiplier);",
    "              multiplier += seedsRewarded;\n              setCollectableValueMultiplier(multiplier);\n              multiplierBadge.set(multiplier);",
    "bonus label increase"
  );

  source = replaceOnce(
    source,
    "    let cascadeCount = 0;\n    let potCash = 0;",
    "    let cascadeCount = 0;\n    let refillCount = 0;\n    let potCash = 0;",
    "seek refill counter"
  );

  source = replaceOnce(
    source,
    "      if (step.type === \"cascade\") {\n        seedsSeenSoFar += (step.changes ?? []).filter((c) => c.symbol === \"spiritSeed\").length;",
    "      if (step.type === \"cascade\") {\n        refillCount += 1;\n        seedsSeenSoFar += (step.changes ?? []).filter((c) => c.symbol === \"spiritSeed\").length;",
    "seek cascade count"
  );

  source = replaceOnce(
    source,
    "    setBoardInstant(board);\n    setStatus(activeRound.steps[clamped]?.message ?? \"\");",
    "    setCollectableValueMultiplier(bonusActive ? multiplier : getCascadeValueMultiplier(refillCount + 1));\n    setBoardInstant(board);\n    setStatus(activeRound.steps[clamped]?.message ?? \"\");",
    "seek label multiplier"
  );

  return source;
});

patch("src/lib/wildwood.test.ts", (input) => {
  let source = input;
  source = replaceOnce(
    source,
    'import { WILDWOOD_CONFIG, applyChanges, isAllowedStake, resolveCollection, resolveWildwoodRound, simulateWildwood } from "./wildwood";',
    'import { WILDWOOD_CONFIG, applyChanges, formatCollectableValueLabel, getCascadeValueMultiplier, getScaledCollectableValue, isAllowedStake, resolveCollection, resolveWildwoodRound, simulateWildwood } from "./wildwood";',
    "test helper imports"
  );

  source = replaceOnce(
    source,
    "  it(\"only accepts configured stakes\", () => {",
    `  it(\"increases collectable values by 50% per cascade and formats exact labels\", () => {\n    expect(WILDWOOD_CONFIG.cascadeMultipliers).toEqual([1, 1.5, 2, 2.5, 3, 3.5]);\n    expect(getCascadeValueMultiplier(1)).toBe(1);\n    expect(getCascadeValueMultiplier(4)).toBe(2.5);\n    expect(getCascadeValueMultiplier(99)).toBe(3.5);\n    expect(getScaledCollectableValue(\"leaf\", getCascadeValueMultiplier(2))).toBe(0.0375);\n    expect(formatCollectableValueLabel(0.0375)).toBe(\"0.0375x\");\n    expect(formatCollectableValueLabel(1.75)).toBe(\"1.75x\");\n  });\n\n  it(\"only accepts configured stakes\", () => {`,
    "cascade value regression test"
  );
  return source;
});

console.log("Applied linear +50% cascade values and synchronized Pixi labels.");
